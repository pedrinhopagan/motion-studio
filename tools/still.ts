// bun tools/still.ts <cena> <saida-dir> <nome=t> [nome=t...]
import { mkdirSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { launchRenderBrowser, MOTION_ROOT, openRenderScene } from "./browser.ts";

const [scene, output, ...shots] = process.argv.slice(2);
if (!scene || !output || !shots.length || !/^[a-z\d-]+$/i.test(scene)) {
	throw new Error("Uso: bun tools/still.ts <cena> <saida-dir> <nome=t> [nome=t...]");
}
const captures = shots.map((shot) => {
	const [name, value] = shot.split("=");
	const time = Number(value);
	if (!name || !/^[a-z\d_-]+$/i.test(name) || !value || !Number.isFinite(time)) {
		throw new Error(`Captura inválida: ${shot}`);
	}
	return { name, time };
});
const { S, W = S, H = S, FPS } = await import(join(MOTION_ROOT, "scenes", scene, "core.js"));
const out = resolve(output);
mkdirSync(out, { recursive: true });

const server = Bun.serve({
	hostname: "127.0.0.1",
	port: 0,
	fetch(req) {
		const path = resolve(MOTION_ROOT, `.${decodeURIComponent(new URL(req.url).pathname)}`);
		if (!path.startsWith(resolve(MOTION_ROOT) + sep)) {
			return new Response("Caminho inválido.", { status: 400 });
		}
		return new Response(Bun.file(path));
	},
});
const browser = await launchRenderBrowser().catch((error) => {
	server.stop(true);
	throw error;
});
try {
	const page = await openRenderScene({ browser, baseURL: server.url.origin, scene, width: W, height: H });
	for (const { name, time } of captures) {
		await page.evaluate(({ time, fps }) => window.seekBlur(time, window.subframes(time), fps), { time, fps: FPS });
		await page.locator("#c").screenshot({ path: join(out, `${name}.png`) });
		console.log(name, time);
	}
} finally {
	await browser.close();
	server.stop(true);
}
