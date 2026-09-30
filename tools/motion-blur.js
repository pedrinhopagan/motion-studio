// Canvas 2D desenha a cena; WebGL combina os subquadros e prepara NV12 para VAAPI.
const vertexShader = `#version 300 es
void main() {
	vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
	gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** @param {{ canvas: HTMLCanvasElement, draw: (ctx: CanvasRenderingContext2D, t: number) => void, duration: number }} options */
export function createMotionRenderer({ canvas, draw, duration }) {
	const { width, height } = canvas;
	const source = document.createElement("canvas");
	source.width = width;
	source.height = height;
	const ctx = source.getContext("2d", { willReadFrequently: false });
	const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: true });

	if (!ctx || !gl || !gl.getExtension("EXT_color_buffer_float") || !gl.getExtension("EXT_float_blend")) {
		throw new Error("O render exige WebGL 2 com buffers de ponto flutuante.");
	}

	const debug = gl.getExtension("WEBGL_debug_renderer_info");
	const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
	const gpu = { renderer: String(renderer), width, height };
	const sample = texture(gl.RGBA8, width, height);
	const sum = target(gl.RGBA32F, width, height);
	const image = target(gl.RGBA8, width, height);
	const uniforms = new WeakMap();
	const add = program(`
		uniform sampler2D sampleImage;
		void main() {
			ivec2 p = ivec2(gl_FragCoord.xy);
			color = round(texelFetch(sampleImage, p, 0) * 255.0);
		}
	`);
	const finish = program(`
		uniform sampler2D sumImage;
		uniform float samples;
		uniform bool blur;
		void main() {
			vec4 sum = texelFetch(sumImage, ivec2(gl_FragCoord.xy), 0);
			// Reproduz o arredondamento Uint8ClampedArray da versão original.
			color = clamp(roundEven(sum / samples + (blur ? 0.5 : 0.0)), 0.0, 255.0) / 255.0;
		}
	`);
	const present = program(`
		uniform sampler2D image;
		void main() { color = texelFetch(image, ivec2(gl_FragCoord.xy), 0); }
	`);
	// Quatro bytes NV12 por pixel RGBA: Y nas primeiras linhas, UV intercalado no final.
	const pack = program(`
		uniform sampler2D image;
		uniform ivec2 size;
		vec3 rgb(ivec2 p) { return texelFetch(image, ivec2(p.x, size.y - 1 - p.y), 0).rgb; }
		float y(ivec2 p) { return dot(rgb(p), vec3(0.182586, 0.614231, 0.062007)) + 16.0 / 255.0; }
		vec2 uv(ivec2 p) {
			vec3 c = (rgb(p) + rgb(p + ivec2(1, 0)) + rgb(p + ivec2(0, 1)) + rgb(p + ivec2(1, 1))) * 0.25;
			return vec2(dot(c, vec3(-0.100644, -0.338572, 0.439216)), dot(c, vec3(0.439216, -0.398942, -0.040274))) + 128.0 / 255.0;
		}
		void main() {
			ivec2 p = ivec2(gl_FragCoord.xy);
			int x = p.x * 4;
			if (p.y < size.y) {
				color = vec4(y(ivec2(x, p.y)), y(ivec2(x + 1, p.y)), y(ivec2(x + 2, p.y)), y(ivec2(x + 3, p.y)));
			} else {
				int row = (p.y - size.y) * 2;
				color = vec4(uv(ivec2(x, row)), uv(ivec2(x + 2, row)));
			}
		}
	`);

	gl.disable(gl.DITHER);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

	/** @param {number} format @param {number} w @param {number} h */
	function texture(format, w, h) {
		const value = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, value);
		gl.texStorage2D(gl.TEXTURE_2D, 1, format, w, h);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return value;
	}

	/** @param {number} format @param {number} w @param {number} h */
	function target(format, w, h) {
		const value = texture(format, w, h);
		const framebuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, value, 0);

		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
			throw new Error("A GPU não conseguiu alocar o framebuffer do render.");
		}

		return { texture: value, framebuffer };
	}

	/** @param {string} fragment */
	function program(fragment) {
		const value = gl.createProgram();
		for (const [type, code] of [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, `#version 300 es\nprecision highp float;\nprecision highp int;\nout vec4 color;\n${fragment}`]]) {
			const shader = gl.createShader(type);
			gl.shaderSource(shader, code);
			gl.compileShader(shader);
			gl.attachShader(value, shader);
			gl.deleteShader(shader);
		}
		gl.linkProgram(value);

		if (!gl.getProgramParameter(value, gl.LINK_STATUS)) {
			throw new Error(`Shader do render: ${gl.getProgramInfoLog(value)}`);
		}

		return value;
	}

	/** @param {WebGLProgram} value @param {string} name @param {WebGLTexture} image @param {number} unit */
	function bind(value, name, image, unit) {
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, image);
		gl.uniform1i(location(value, name), unit);
	}

	/** @param {WebGLProgram} value @param {string} name */
	function location(value, name) {
		if (!uniforms.has(value)) {
			uniforms.set(value, new Map());
		}
		const entries = uniforms.get(value);
		if (!entries.has(name)) {
			entries.set(name, gl.getUniformLocation(value, name));
		}
		return entries.get(name);
	}

	/** @param {number} t @param {number} samples @param {number} fps */
	function render(t, samples, fps) {
		if (gl.isContextLost()) {
			throw new Error("O contexto da GPU foi perdido durante o render.");
		}

		gl.viewport(0, 0, width, height);
		gl.bindFramebuffer(gl.FRAMEBUFFER, sum.framebuffer);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.useProgram(add);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE);

		for (let i = 0; i < samples; i++) {
			const at = t + ((i + 0.5) / samples - 0.5) * (0.5 / fps);
			draw(ctx, ((at % duration) + duration) % duration);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, sample);
			gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
			bind(add, "sampleImage", sample, 1);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		}

		gl.disable(gl.BLEND);
		gl.bindFramebuffer(gl.FRAMEBUFFER, image.framebuffer);
		gl.useProgram(finish);
		bind(finish, "sumImage", sum.texture, 0);
		gl.uniform1f(location(finish, "samples"), samples);
		gl.uniform1i(location(finish, "blur"), samples > 1);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.useProgram(present);
		bind(present, "image", image.texture, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.flush();
	}

	// A leitura ocorre uma vez por quadro final, após desfoque e conversão de cor na GPU.
	const packed = width % 4 === 0 && height % 2 === 0 ? target(gl.RGBA8, width / 4, height * 3 / 2) : null;
	const pixels = new Uint8Array(width * height * 3 / 2);
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
	gl.bufferData(gl.PIXEL_PACK_BUFFER, pixels.byteLength, gl.STREAM_READ);
	gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	async function readNV12() {
		if (!packed) {
			throw new Error("A exportação NV12 exige largura múltipla de 4 e altura par.");
		}

		gl.bindFramebuffer(gl.FRAMEBUFFER, packed.framebuffer);
		gl.viewport(0, 0, width / 4, height * 3 / 2);
		gl.useProgram(pack);
		bind(pack, "image", image.texture, 0);
		gl.uniform2i(location(pack, "size"), width, height);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
		gl.readPixels(0, 0, width / 4, height * 3 / 2, gl.RGBA, gl.UNSIGNED_BYTE, 0);
		const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
		gl.flush();

		try {
			while (true) {
				const status = gl.clientWaitSync(fence, 0, 0);
				if (status === gl.WAIT_FAILED || gl.isContextLost()) {
					throw new Error("Falha ao transferir o quadro da GPU.");
				}
				if (status !== gl.TIMEOUT_EXPIRED) {
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 1));
			}
			gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels);
			return pixels;
		} finally {
			gl.deleteSync(fence);
			gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		}
	}

	return { render, readNV12, gpu };
}
