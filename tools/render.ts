// bun tools/render.ts <cena> <saida.mp4|frames-dir> [workers=2] [--start-frame N] [--frames N] [--audio arquivo.wav]
// MP4: desfoque e NV12 em WebGL, quadros enviados diretamente ao encoder VAAPI.
import { linkSync, mkdirSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { launchRenderBrowser, MOTION_ROOT, openRenderScene } from "./browser.ts";

const [scene, output, ...args] = process.argv.slice(2);
if (!scene || !output || !/^[a-z\d-]+$/i.test(scene)) {
	throw new Error("Uso: bun tools/render.ts <cena> <saida.mp4|frames-dir> [workers=2] [--start-frame N] [--frames N] [--audio arquivo.wav]");
}

const options = { workers: 2, start: 0, frames: 0, audio: "" };
if (args[0] && !args[0].startsWith("--")) {
	options.workers = Number(args.shift());
}
for (let i = 0; i < args.length; i += 2) {
	const value = args[i + 1];
	if (!value) {
		throw new Error(`Falta o valor de ${args[i]}.`);
	}
	switch (args[i]) {
		case "--start-frame": options.start = Number(value); break;
		case "--frames": options.frames = Number(value); break;
		case "--audio": options.audio = resolve(value); break;
		default: throw new Error(`Opção desconhecida: ${args[i]}`);
	}
}
for (const [name, value] of Object.entries({ workers: options.workers, start: options.start, frames: options.frames })) {
	if (!Number.isSafeInteger(value) || value < 0 || (name === "workers" && value < 1)) {
		throw new Error(`${name} deve ser um inteiro válido.`);
	}
}
if (options.audio && !await Bun.file(options.audio).exists()) {
	throw new Error(`Áudio não encontrado: ${options.audio}`);
}

const { DUR, FPS, S, W = S, H = S } = await import(join(MOTION_ROOT, "scenes", scene, "core.js"));
if (![W, H].every((size) => Number.isSafeInteger(size) && size >= 64 && size <= 7680 && size % 2 === 0)) {
	throw new Error("A resolução deve ter dimensões pares entre 64 e 7680 pixels.");
}
if (W % 4 !== 0) {
	throw new Error("A largura deve ser múltipla de 4 para exportar NV12.");
}
const total = Math.round(DUR * FPS);
const count = options.frames || total - options.start;
if (options.start >= total || count < 1 || options.start + count > total) {
	throw new Error(`O intervalo deve ficar dentro dos ${total} quadros da cena.`);
}
const video = output.toLowerCase().endsWith(".mp4");
const out = resolve(output);
if (video && await Bun.file(out).exists()) {
	throw new Error(`A saída já existe: ${out}`);
}

mkdirSync(video ? dirname(out) : out, { recursive: true });
const encodedOut = join(dirname(out), `.${basename(out)}.${crypto.randomUUID()}.partial.mp4`);

const encoder = video ? Bun.spawn([
	"ffmpeg", "-hide_banner", "-loglevel", "warning", "-n", "-vaapi_device", "/dev/dri/renderD128",
	"-f", "rawvideo", "-pixel_format", "nv12", "-video_size", `${W}x${H}`, "-framerate", String(FPS),
	"-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-i", "pipe:0",
	...(options.audio ? ["-ss", String(options.start / FPS), "-i", options.audio] : []),
	"-map", "0:v:0", ...(options.audio ? ["-map", "1:a:0", "-c:a", "aac", "-b:a", "192k"] : []),
	"-vf", "hwupload", "-c:v", "h264_vaapi", "-rc_mode", "CQP", "-qp", "18", "-bf", "0", "-g", String(FPS * 2),
	"-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
	"-t", String(count / FPS), "-movflags", "+faststart", encodedOut,
], { stdin: "pipe", stdout: "ignore", stderr: "inherit" }) : undefined;

async function stopEncoder() {
	if (!encoder || encoder.exitCode !== null) {
		return;
	}
	encoder.kill();
	const forced = setTimeout(() => encoder.kill("SIGKILL"), 5_000);
	try {
		await encoder.exited;
	} finally {
		clearTimeout(forced);
	}
}

const pending = new Map<number, { bytes: Uint8Array; resolve: () => void; reject: (error: unknown) => void }>();
let next = options.start;
let draining = false;
let failure: unknown;
let cancelled = false;

async function drain() {
	if (draining || !encoder) {
		return;
	}
	draining = true;
	try {
		while (pending.has(next)) {
			const frame = pending.get(next)!;
			encoder.stdin.write(frame.bytes);
			await encoder.stdin.flush();
			pending.delete(next++);
			frame.resolve();
		}
	} catch (error) {
		failure = error;
		for (const frame of pending.values()) {
			frame.reject(error);
		}
		pending.clear();
	} finally {
		draining = false;
	}
}

const server = Bun.serve({
	hostname: "127.0.0.1",
	port: 0,
	idleTimeout: 60,
	fetch(req, server) {
		const url = new URL(req.url);
		if (url.pathname === "/__frames" && encoder) {
			if (server.upgrade(req)) {
				return;
			}
			return new Response("É necessária uma conexão WebSocket.", { status: 400 });
		}
		const path = resolve(MOTION_ROOT, `.${decodeURIComponent(url.pathname)}`);
		if (!path.startsWith(resolve(MOTION_ROOT) + sep)) {
			return new Response("Caminho inválido.", { status: 400 });
		}
		return new Response(Bun.file(path));
	},
	websocket: {
		maxPayloadLength: W * H * 3 / 2 + 4,
		async message(socket, packet) {
			if (typeof packet === "string" || packet.byteLength !== W * H * 3 / 2 + 4 || !encoder || failure || encoder.exitCode !== null) {
				socket.close(1011, "Quadro inválido ou encoder parado.");
				return;
			}
			const index = new DataView(packet.buffer, packet.byteOffset, 4).getUint32(0, true);
			if (index < next || index >= options.start + count || pending.has(index)) {
				socket.close(1008, "Quadro fora de ordem.");
				return;
			}
			try {
				await new Promise<void>((resolve, reject) => {
					pending.set(index, { bytes: packet.subarray(4), resolve, reject });
					void drain();
				});
				socket.send(String(index));
			} catch {
				socket.close(1011, "Falha no encoder.");
			}
		},
	},
});

const browser = await launchRenderBrowser().catch(async (error) => {
	server.stop(true);
	await stopEncoder();
	if (video) {
		rmSync(encodedOut, { force: true });
	}
	throw error;
});
let done = 0;
const timings = { render: 0, readback: 0, transfer: 0 };
const started = performance.now();
const timeout = setTimeout(() => cancel("O render excedeu 15 minutos."), 900_000);

function cancel(reason: string) {
	if (cancelled) {
		return;
	}
	cancelled = true;
	failure = new Error(reason);
	encoder?.kill("SIGKILL");
	if (video) {
		rmSync(encodedOut, { force: true });
	}
	for (const frame of pending.values()) {
		frame.reject(failure);
	}
	pending.clear();
	server.stop(true);
	void browser.close();
}
const interrupted = () => cancel("Render interrompido.");
process.once("SIGINT", interrupted);
process.once("SIGTERM", interrupted);
void encoder?.exited.then((code) => {
	if (code !== 0) {
		cancel(`FFmpeg terminou com código ${code}.`);
	}
});

try {
	console.log(video ? "[vídeo] NV12 na GPU, H.264 VAAPI QP 18" : "[quadros] desfoque na GPU, saída PNG");
	await Promise.all(Array.from({ length: Math.min(options.workers, count) }, async (_, worker) => {
		const page = await openRenderScene({ browser, baseURL: server.url.origin, scene, width: W, height: H });
		try {
			if (video) {
				await page.evaluate(async (url) => {
					const { connectFrameStream } = await import(new URL("/tools/video-stream.js", location.href).href);
					window.frameStream = await connectFrameStream(url);
				}, `${server.url.origin.replace("http:", "ws:")}/__frames`);
			}
			for (let frame = options.start + worker; frame < options.start + count; frame += options.workers) {
				const timing = await page.evaluate(async ({ frame, fps, video }) => {
					const t = frame / fps;
					const start = performance.now();
					window.seekBlur(t, window.subframes(t), fps);
					const rendered = performance.now();
					if (video) {
						const bytes = await window.motionRenderer.readNV12();
						const read = performance.now();
						await window.frameStream.send(frame, bytes);
						return { render: rendered - start, readback: read - rendered, transfer: performance.now() - read };
					}
					return { render: rendered - start, readback: 0, transfer: 0 };
				}, { frame, fps: FPS, video });
				timings.render += timing.render;
				timings.readback += timing.readback;
				timings.transfer += timing.transfer;
				if (!video) {
					await page.locator("#c").screenshot({ path: join(out, `${String(frame).padStart(4, "0")}.png`) });
				}
				if (++done % 60 === 0) {
					console.log(`${done}/${count} quadros em ${((performance.now() - started) / 1000).toFixed(1)} s`);
				}
			}
		} finally {
			await page.close();
		}
	}));
	if (failure) {
		throw failure;
	}
	if (encoder) {
		await encoder.stdin.end();
		const code = await encoder.exited;
		if (code !== 0) {
			throw new Error(`FFmpeg terminou com código ${code}.`);
		}
		// Publica apenas o vídeo completo, sem sobrescrever uma saída existente.
		linkSync(encodedOut, out);
	}
	console.log(`ok ${done} quadros em ${((performance.now() - started) / 1000).toFixed(1)} s: ${out}`);
	console.log(`[média/quadro] desenho ${(timings.render / done).toFixed(1)} ms, leitura ${(timings.readback / done).toFixed(1)} ms, envio ${(timings.transfer / done).toFixed(1)} ms`);
} finally {
	clearTimeout(timeout);
	process.removeListener("SIGINT", interrupted);
	process.removeListener("SIGTERM", interrupted);
	for (const frame of pending.values()) {
		frame.reject(new Error("Render encerrado."));
	}
	server.stop(true);
	await stopEncoder();
	if (video) {
		rmSync(encodedOut, { force: true });
	}
	await browser.close();
}
