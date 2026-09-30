// Núcleo puro: tudo aqui é função do tempo ou do contexto, sem estado entre quadros.
export const S = 1440;
export const FPS = 60;
export const DUR = (56 * 60) / 112.5; // 56 batidas de 112,5 BPM = 29,8667 s, exatos 1792 quadros
export const GLIDE = 0.8;

export const C = {
	bg0: "#fbfcfe",
	bg1: "#f2f6fa",
	dot: "#d9e0e8",
	card: "#ffffff",
	border: "#e4e8ee",
	ink: "#091124",
	ink2: "#3b485e",
	ink3: "#6b778c",
	blue: "#1b7fb6",
	blueSoft: "#e8f3fa",
	teal: "#0d9488",
	tealSoft: "#e6f6f4",
};

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, k) => a + (b - a) * k;

// cubic-bezier(.45,0,.15,1), resolvido por Newton + bisseção.
function bezier(x1, y1, x2, y2) {
	const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
	const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
	const X = (u) => ((ax * u + bx) * u + cx) * u;
	const Y = (u) => ((ay * u + by) * u + cy) * u;
	const dX = (u) => (3 * ax * u + 2 * bx) * u + cx;
	return (x) => {
		if (x <= 0) return 0;
		if (x >= 1) return 1;
		let u = x;
		for (let i = 0; i < 8; i++) {
			const d = dX(u);
			if (Math.abs(d) < 1e-6) break;
			u -= (X(u) - x) / d;
		}
		if (u < 0 || u > 1 || Math.abs(X(u) - x) > 1e-5) {
			let lo = 0, hi = 1;
			for (let i = 0; i < 40; i++) {
				u = (lo + hi) / 2;
				if (X(u) < x) lo = u; else hi = u;
			}
		}
		return Y(u);
	};
}
export const ease = bezier(0.45, 0, 0.15, 1);

// progresso cru e com easing de um glide que começa em t0
export const raw = (t, t0, d = GLIDE) => clamp((t - t0) / d);
export const g = (t, t0, d = GLIDE) => ease(raw(t, t0, d));
// dissolve no back half do glide
export const back = (t, t0, d = GLIDE) => ease(clamp((t - t0 - d / 2) / (d / 2)));
export const front = (t, t0, d = GLIDE) => 1 - ease(clamp((t - t0) / (d / 2)));

export function hex(c) {
	const n = parseInt(c.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mixc(a, b, k) {
	const A = hex(a), B = hex(b);
	return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], k))).join(",")})`;
}

// câmera: keyframes {t, x, y, z}; entre dois, glide de 0.8s no mesmo easing, zoom em log.
export function camera(keys, t) {
	let k = keys[0];
	for (let i = 1; i < keys.length; i++) {
		const n = keys[i];
		if (t < n.t) break;
		const d = n.d ?? GLIDE;
		const e = g(t, n.t, d);
		k = {
			x: lerp(k.x, n.x, e),
			y: lerp(k.y, n.y, e),
			z: Math.exp(lerp(Math.log(k.z), Math.log(n.z), e)),
		};
	}
	return k;
}

export function applyCam(ctx, cam) {
	ctx.setTransform(cam.z, 0, 0, cam.z, S / 2 - cam.x * cam.z, S / 2 - cam.y * cam.z);
}

export function stage(ctx, cam) {
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	const gr = ctx.createLinearGradient(0, 0, 0, S);
	gr.addColorStop(0, C.bg0);
	gr.addColorStop(1, C.bg1);
	ctx.fillStyle = gr;
	ctx.fillRect(0, 0, S, S);
	// grade de pontos no mundo, com níveis que dobram quando o passo na tela cai abaixo de 14px
	const lvl = Math.log2(14 / (14 * cam.z));
	const k0 = Math.floor(lvl);
	const f = lvl - k0;
	for (const [k, a] of [[k0, 1 - f], [k0 + 1, f]]) {
		if (a < 0.02) continue;
		const step = 14 * 2 ** Math.max(k, -3) * cam.z;
		const ox = (S / 2 - cam.x * cam.z) % step;
		const oy = (S / 2 - cam.y * cam.z) % step;
		ctx.fillStyle = C.dot;
		ctx.globalAlpha = a;
		for (let y = oy; y < S; y += step) for (let x = ox; x < S; x += step) ctx.fillRect(x - 1, y - 1, 2, 2);
	}
	ctx.globalAlpha = 1;
}

export function rr(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
}

// sombra suave em camadas, crescendo com a altura do cartão
export function card(ctx, x, y, w, h, { r = 10, fill = C.card, border = C.border, lift = 1, z = 1 } = {}) {
	const s = clamp(h / 400, 0.25, 1.6) * lift;
	ctx.save();
	ctx.fillStyle = fill;
	for (const [oy, blur, a] of [[1, 2, 0.05], [4, 12, 0.05], [14, 36, 0.06]]) {
		ctx.shadowColor = `rgba(9,17,36,${a * clamp(lift, 0, 2)})`;
		ctx.shadowBlur = blur * s * z;
		ctx.shadowOffsetY = oy * s * z;
		rr(ctx, x, y, w, h, r);
		ctx.fill();
	}
	ctx.restore();
	rr(ctx, x, y, w, h, r);
	ctx.fillStyle = fill;
	ctx.fill();
	if (border) {
		ctx.lineWidth = 1;
		ctx.strokeStyle = border;
		rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
		ctx.stroke();
	}
}

export function text(ctx, s, x, y, { size = 14, weight = 500, color = C.ink, align = "left", base = "middle", track = 0 } = {}) {
	ctx.font = `${weight} ${size}px Inter`;
	ctx.fillStyle = color;
	ctx.textAlign = align;
	ctx.textBaseline = base;
	ctx.letterSpacing = `${track}px`;
	ctx.fillText(s, x, y);
	ctx.letterSpacing = "0px";
}
export function tw(ctx, s, size = 14, weight = 500) {
	ctx.font = `${weight} ${size}px Inter`;
	return ctx.measureText(s).width;
}

export function pill(ctx, s, x, y, { bg = C.tealSoft, fg = C.teal, size = 12, weight = 600, h = 22, pad = 9, align = "left" } = {}) {
	const w = tw(ctx, s, size, weight) + pad * 2;
	const px = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
	rr(ctx, px, y - h / 2, w, h, h / 2);
	ctx.fillStyle = bg;
	ctx.fill();
	text(ctx, s, px + pad, y + 0.5, { size, weight, color: fg });
	return w;
}

// flood: círculo que cresce da causa até o canto mais distante em ~0.4s, recortado ao retângulo
export function flood(ctx, rect, cx, cy, k, color) {
	if (k <= 0) return;
	const [x, y, w, h, r] = rect;
	const far = Math.max(...[[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([a, b]) => Math.hypot(a - cx, b - cy)));
	ctx.save();
	rr(ctx, x, y, w, h, r);
	ctx.clip();
	ctx.beginPath();
	ctx.arc(cx, cy, far * ease(clamp(k)), 0, Math.PI * 2);
	ctx.fillStyle = color;
	ctx.fill();
	ctx.restore();
}

// fluxo: linha tracejada azul com um ponto correndo, como na landing
export function flow(ctx, pts, { reveal = 1, dot = -1, color = "rgba(27,127,182,0.6)", width = 1.3, dash = [4, 4], alpha = 1, dotColor = C.blue } = {}) {
	if (reveal <= 0 || alpha <= 0) return;
	const segs = [];
	let L = 0;
	for (let i = 1; i < pts.length; i++) {
		const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
		segs.push(l);
		L += l;
	}
	const at = (d) => {
		for (let i = 0; i < segs.length; i++) {
			if (d <= segs[i] || i === segs.length - 1) {
				const k = segs[i] ? clamp(d / segs[i]) : 0;
				return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)];
			}
			d -= segs[i];
		}
	};
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.setLineDash(dash);
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(...pts[0]);
	let rem = L * reveal;
	for (let i = 1; i < pts.length && rem > 0; i++) {
		const k = clamp(rem / segs[i - 1]);
		ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k));
		rem -= segs[i - 1];
	}
	ctx.stroke();
	ctx.setLineDash([]);
	if (dot >= 0 && dot <= 1) {
		// ponto da landing: 8px com halo de 3px a 20%
		const [px, py] = at(L * dot);
		ctx.beginPath();
		ctx.arc(px, py, 7, 0, Math.PI * 2);
		ctx.fillStyle = dotColor;
		ctx.globalAlpha = alpha * 0.2;
		ctx.fill();
		ctx.beginPath();
		ctx.arc(px, py, 4, 0, Math.PI * 2);
		ctx.globalAlpha = alpha;
		ctx.fill();
	}
	ctx.restore();
	return at;
}

// ponteiro do macOS em vetor (seta preta, contorno branco), em coordenadas de tela
export function cursor(ctx, x, y, { scale = 1.5, press = 0 } = {}) {
	const s = scale * (1 - 0.1 * press);
	const p = [[0, 0], [0, 17], [4.1, 13.1], [6.8, 19.4], [9.6, 18.2], [7, 12.1], [12.6, 12.1]];
	ctx.save();
	ctx.setTransform(s, 0, 0, s, x, y);
	ctx.shadowColor = "rgba(0,0,0,0.3)";
	ctx.shadowBlur = 3 * s;
	ctx.shadowOffsetY = 1 * s;
	ctx.beginPath();
	p.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
	ctx.closePath();
	ctx.lineJoin = "round";
	ctx.lineWidth = 2.2;
	ctx.strokeStyle = "#fff";
	ctx.stroke();
	ctx.shadowColor = "transparent";
	ctx.fillStyle = "#000";
	ctx.fill();
	ctx.restore();
}

export const brl = (v) => "R$ " + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
