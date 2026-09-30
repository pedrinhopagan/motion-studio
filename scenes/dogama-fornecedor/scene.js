import { S, C, DUR, clamp, lerp, ease, raw, g, back, front, mixc, camera, applyCam, stage, rr, card, text, tw, pill, flood, flow, cursor } from "./core.js";

const A = "../../assets/dogama-fornecedor";
const IMG = {};
const SRC = {
	shoe: `${A}/product/1dd4c175-1cb4-5a37-bcd6-dff1b4c2dc8a.webp`,
	...Object.fromEntries(["r10", "r11", "r12", "r13", "r20", "r21", "r22"].map((k) => [k, `${A}/catalog/print/r${k[1]}-${k[2]}.png`])),
	ml: `${A}/logos/mercado-livre.svg`,
	shopee: `${A}/logos/shopee.svg`,
	tiktok: `${A}/logos/tiktok.svg`,
	shein: `${A}/logos/shein.svg`,
	shopify: `${A}/logos/shopify.svg`,
	nuvem: `${A}/logos/nuvemshop.svg`,
	symbol: `${A}/logo/symbol_color.svg`,
	name: `${A}/logo/name_only_color.svg`,
};
export async function load() {
	await Promise.all(
		Object.entries(SRC).map(([k, src]) => {
			const im = new Image();
			im.src = src;
			IMG[k] = im;
			return im.decode();
		}),
	);
}

// ---------- tempo: grade da música (Can't Get You Off My Mind, 75 BPM); n em batidas de 0,5333 s desde o quadro 0 ----------
// 3 batidas da cena = 2 da faixa (tercinas): b(0), b(3), b(6)… caem na batida e b(24) = 12,8 s = 4 compassos, no drop
export const BEAT = 60 / 112.5;
const b = (n) => n * BEAT;
export const T = {
	shopee: b(1.5), // venda própria na Shopee sai do canal
	stock39: b(3), // chega no estoque
	press: b(7), // cursor aperta ↪ Publicar produto
	confirm: b(10.5), // cursor aperta Publicar no painel
	published: b(10.75), // painel fecha, toast entra, ↪ fica teal
	lift: b(14), // linha vira card
	pan: b(16), // câmera viaja até a loja
	anunciar: b(19), // revendedor aperta Anunciar no card
	pull: b(19.5), // recua até as vitrines
	sale: [b(24), b(25), b(26)], // três vitrines vendem; drop da música em b(24)
	arrive: [b(28), b(28.75), b(29.5), b(30.25)], // drop, própria, drop, drop
	toStock: b(31),
	unit: [b(32.5), b(33.25), b(34), b(34.75)], // 39 → 35
	toDesk: b(36.5),
	scan: b(39),
	shipped: [b(39.5), b(39.75), b(40), b(40.25)],
	repasse: [b(41.5), b(42.25), b(43)], // chips saem; chegam 0,8 s depois
	end: b(46.5), // carteira afina numa linha
	fold: b(48), // linha dobra no hexágono
	word: b(49.5), // wordmark e frase
	back: DUR - 0.8, // hexágono desdobra no card; pousa em DUR = 0
};
// cada clique: o cursor viaja 0,8 s e aperta 0,15 s depois de chegar
const CLICKS = [T.press, T.confirm, T.anunciar, T.scan];
const REACH = 0.95;

// ---------- mundo ----------
const SUP = { x: -850, y: 0 }; // lado do fornecedor
const MID = { x: 0, y: 0 }; // o estoque
const CAT = { x: 1150, y: 0 }; // catálogo e vitrines
const WAL = { x: -850, y: -600 }; // carteira

const CAMS = [
	{ t: 0, x: SUP.x, y: 40, z: 1.72 },
	{ t: T.press, x: SUP.x, y: 110, z: 1.5 },
	{ t: T.pan, x: CAT.x, y: 0, z: 1.2, fast: true },
	{ t: T.pull, x: CAT.x, y: 10, z: 0.82 },
	// aproximação lenta enquanto as vitrines esperam a venda, para não parar
	{ t: T.pull + 0.8, x: CAT.x, y: 10, z: 0.86, d: T.sale[0] - T.pull - 0.8 },
	{ t: T.sale[0], x: 420, y: 90, z: 0.47, fast: true },
	{ t: T.sale[2] + 0.75 * BEAT, x: SUP.x, y: 10, z: 1.35, fast: true }, // depois da 3ª venda, não durante
	{ t: T.toStock, x: -190, y: 10, z: 1.4 },
	{ t: T.toDesk, x: SUP.x, y: 20, z: 1.3 },
	{ t: T.repasse[0], x: SUP.x, y: -330, z: 1.0 },
	{ t: T.end, x: WAL.x, y: WAL.y + 40, z: 1.3 },
	{ t: T.word + 0.8, x: WAL.x, y: WAL.y + 40, z: 1.36, d: T.back - T.word - 0.8 },
	{ t: T.back, x: SUP.x, y: 40, z: 1.72 },
];

export function subframes(t) {
	for (const k of CAMS) if (k.fast && t >= k.t && t < k.t + (k.d ?? 0.8)) return 12;
	return 4;
}

// ---------- ícones simples em traço ----------
function icon(ctx, name, x, y, s, color, lw = 1.5) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s / 16, s / 16);
	ctx.strokeStyle = color;
	ctx.fillStyle = color;
	ctx.lineWidth = lw * (16 / s);
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.beginPath();
	if (name === "check") {
		ctx.moveTo(3.5, 8.5);
		ctx.lineTo(6.5, 11.5);
		ctx.lineTo(12.5, 4.5);
	} else if (name === "edit") {
		ctx.rect(2.5, 3.5, 10, 10);
		ctx.moveTo(7, 9);
		ctx.lineTo(13.5, 2.5);
	} else if (name === "share") {
		ctx.moveTo(2.5, 12);
		ctx.quadraticCurveTo(3, 6.5, 9, 6.5);
		ctx.lineTo(13.5, 6.5);
		ctx.moveTo(10.5, 3.5);
		ctx.lineTo(13.5, 6.5);
		ctx.lineTo(10.5, 9.5);
	} else if (name === "chart") {
		ctx.moveTo(2.5, 2.5);
		ctx.lineTo(2.5, 13.5);
		ctx.lineTo(13.5, 13.5);
		ctx.moveTo(4.5, 10.5);
		ctx.lineTo(7.5, 7);
		ctx.lineTo(9.5, 9);
		ctx.lineTo(13, 5);
	} else if (name === "upload") {
		ctx.rect(2, 3, 12, 8.5);
		ctx.moveTo(8, 13.5);
		ctx.lineTo(8, 6);
		ctx.moveTo(5.5, 8.5);
		ctx.lineTo(8, 6);
		ctx.lineTo(10.5, 8.5);
	} else if (name === "info") {
		ctx.arc(8, 8, 6.5, 0, Math.PI * 2);
		ctx.moveTo(8, 7.5);
		ctx.lineTo(8, 11);
		ctx.moveTo(8, 5);
		ctx.lineTo(8, 5.1);
	} else if (name === "calendar") {
		ctx.rect(2.5, 3.5, 11, 10);
		ctx.moveTo(2.5, 6.5);
		ctx.lineTo(13.5, 6.5);
		ctx.moveTo(5.5, 2);
		ctx.lineTo(5.5, 4.5);
		ctx.moveTo(10.5, 2);
		ctx.lineTo(10.5, 4.5);
	} else if (name === "box") {
		ctx.moveTo(8, 1.8);
		ctx.lineTo(14, 5);
		ctx.lineTo(14, 11);
		ctx.lineTo(8, 14.2);
		ctx.lineTo(2, 11);
		ctx.lineTo(2, 5);
		ctx.closePath();
		ctx.moveTo(2, 5);
		ctx.lineTo(8, 8.2);
		ctx.lineTo(14, 5);
		ctx.moveTo(8, 8.2);
		ctx.lineTo(8, 14.2);
	} else if (name === "scan") {
		ctx.moveTo(2, 5);
		ctx.lineTo(2, 2);
		ctx.lineTo(5, 2);
		ctx.moveTo(11, 2);
		ctx.lineTo(14, 2);
		ctx.lineTo(14, 5);
		ctx.moveTo(14, 11);
		ctx.lineTo(14, 14);
		ctx.lineTo(11, 14);
		ctx.moveTo(5, 14);
		ctx.lineTo(2, 14);
		ctx.lineTo(2, 11);
		for (const xx of [5, 7, 9.5, 11]) {
			ctx.moveTo(xx, 5);
			ctx.lineTo(xx, 11);
		}
	} else if (name === "wallet") {
		ctx.roundRect(2, 4, 12, 9.5, 2);
		ctx.moveTo(10, 8.75);
		ctx.lineTo(11.5, 8.75);
		ctx.moveTo(3.5, 4);
		ctx.lineTo(11, 2);
	} else if (name === "chevron") {
		ctx.moveTo(6, 3.5);
		ctx.lineTo(10.5, 8);
		ctx.lineTo(6, 12.5);
	}
	ctx.stroke();
	ctx.restore();
}

function photo(ctx, im, x, y, w, h, r = 8) {
	ctx.save();
	rr(ctx, x, y, w, h, r);
	ctx.clip();
	ctx.fillStyle = "#fff";
	ctx.fillRect(x, y, w, h);
	const s = Math.max(w / im.width, h / im.height);
	ctx.drawImage(im, x + (w - im.width * s) / 2, y + (h - im.height * s) / 2, im.width * s, im.height * s);
	ctx.restore();
}

function logo(ctx, key, x, y, s) {
	const im = IMG[key];
	const k = s / Math.max(im.width, im.height);
	ctx.drawImage(im, x - (im.width * k) / 2, y - (im.height * k) / 2, im.width * k, im.height * k);
}

function chip(ctx, s, x, y, { h = 22, size = 12, bg = "#f5f7fa", border = C.border, color = C.ink2 } = {}) {
	const w = tw(ctx, s, size, 500) + 14;
	rr(ctx, x, y, w, h, 5);
	ctx.fillStyle = bg;
	ctx.fill();
	ctx.strokeStyle = border;
	ctx.lineWidth = 1;
	ctx.stroke();
	text(ctx, s, x + 7, y + h / 2 + 0.5, { size, weight: 500, color });
	return w;
}

// número que troca em valores inteiros: o antigo sobe e some, o novo sobe e chega (0,2 s)
function swapNum(ctx, t, times, values, x, y, opts, fmt = (v) => v) {
	let i = 0;
	while (i < times.length && t >= times[i]) i++;
	const k = i > 0 ? ease(clamp((t - times[i - 1]) / 0.22)) : 1;
	const cur = fmt(values[i]);
	if (k >= 1 || i === 0) return text(ctx, cur, x, y, opts);
	ctx.save();
	ctx.globalAlpha = 1 - k;
	text(ctx, fmt(values[i - 1]), x, y - 8 * k, opts);
	ctx.globalAlpha = k;
	text(ctx, cur, x, y + 8 * (1 - k), opts);
	ctx.restore();
}

// ---------- telas ----------
const TITLE = "Tênis Masculino de Corrida Free-Run";

// card do produto em /app/erp/produtos (548 × 360 no print 01)
const ERP = { w: 548, h: 360 };
function erpCard(ctx, t, x, y, a = 1) {
	ctx.save();
	ctx.globalAlpha *= a;
	card(ctx, x, y, ERP.w, ERP.h, { r: 10 });
	// cabeçalho
	rr(ctx, x + 16, y + 9, 94, 26, 6);
	ctx.strokeStyle = C.border;
	ctx.stroke();
	rr(ctx, x + 26, y + 16, 12, 12, 3);
	ctx.strokeStyle = "#9aa4b2";
	ctx.stroke();
	text(ctx, "Selecionar", x + 45, y + 22.5, { size: 12, color: C.ink2 });
	icon(ctx, "calendar", x + 408, y + 15, 13, C.ink3, 1.3);
	text(ctx, "17/09/2026 - 10:44", x + 426, y + 22.5, { size: 12, color: C.ink2 });
	line(ctx, x, y + 45, x + ERP.w, y + 45);
	// corpo
	rr(ctx, x + 16, y + 61, 112, 112, 8);
	ctx.strokeStyle = C.border;
	ctx.stroke();
	photo(ctx, IMG.shoe, x + 17, y + 62, 110, 110, 7);
	text(ctx, "Categoria não definida", x + 140, y + 71, { size: 13, color: C.ink3, weight: 400 });
	text(ctx, TITLE, x + 140, y + 91, { size: 16, color: C.ink, weight: 500 });
	text(ctx, "R$ 99,90", x + 140, y + 127, { size: 20, color: C.ink, weight: 700 });
	let cx = x + 140;
	cx += chip(ctx, "Simples", cx, y + 153) + 8;
	// estoque: o mesmo número do vídeo inteiro
	const sw = tw(ctx, "Estoque: 40", 12, 500) + 14;
	if (t < T.lift || t >= T.back) stockChip(ctx, t, cx, y + 153, sw);
	cx += sw + 8;
	chip(ctx, "Original", cx, y + 153);
	line(ctx, x + 16, y + 193, x + ERP.w - 16, y + 193);
	// canais próprios
	channelBox(ctx, x + 16, y + 206, "ml", "Mercado Livre");
	channelBox(ctx, x + 278, y + 206, "shopee", "Shopee");
	line(ctx, x, y + 298, x + ERP.w, y + 298);
	// ações
	btn(ctx, x + 16, y + 312, 226, 36, "Editar", { icon: "edit" });
	btn(ctx, x + 250, y + 312, 192, 36, "Anunciar", { icon: "upload", bg: C.blueSoft, color: C.blue, border: null });
	btn(ctx, x + 450, y + 312, 36, 36, "", { icon: "chart" });
	// ↪ Publicar produto: vira teal quando publica
	const pb = [x + 494, y + 312, 36, 36, 6];
	btn(ctx, ...pb.slice(0, 4), "", { icon: "share", bg: C.blueSoft, color: C.blue, border: null });
	const pk = clamp((t - T.published) / 0.4);
	flood(ctx, pb, x + 512, y + 330, pk, C.teal);
	if (pk > 0) icon(ctx, "check", x + 504, y + 322, 16, "#fff", 1.8);
	ctx.restore();
}

function stockChip(ctx, t, x, y, w) {
	const h = 22;
	rr(ctx, x, y, w, h, 5);
	ctx.fillStyle = "#f5f7fa";
	ctx.fill();
	ctx.strokeStyle = C.border;
	ctx.stroke();
	// a chegada da venda da Shopee acende o chip por baixo de um flood
	const k = clamp((t - T.stock39) / 0.4);
	const fade = 1 - clamp((t - T.stock39 - 0.5) / 0.4);
	if (k > 0 && fade > 0) {
		ctx.save();
		ctx.globalAlpha *= fade;
		flood(ctx, [x, y, w, h, 5], x + w / 2, y + h / 2, k, C.blueSoft);
		ctx.restore();
	}
	ctx.save();
	rr(ctx, x, y, w, h, 5);
	ctx.clip();
	text(ctx, "Estoque:", x + 7, y + h / 2 + 0.5, { size: 12, weight: 500, color: C.ink2 });
	swapNum(ctx, t, [T.stock39], [40, 39], x + 7 + tw(ctx, "Estoque: ", 12, 500), y + h / 2 + 0.5, { size: 12, weight: 600, color: C.ink });
	ctx.restore();
}

function channelBox(ctx, x, y, key, name) {
	rr(ctx, x, y, 254, 76, 8);
	ctx.strokeStyle = C.border;
	ctx.lineWidth = 1;
	ctx.stroke();
	rr(ctx, x + 14, y + 16, 44, 44, 9);
	ctx.strokeStyle = C.border;
	ctx.stroke();
	logo(ctx, key, x + 36, y + 38, 28);
	text(ctx, name, x + 72, y + 29, { size: 15, weight: 500, color: C.ink });
	text(ctx, "Sincronizado", x + 72, y + 49, { size: 12.5, color: C.ink3, weight: 400 });
	// marcado
	rr(ctx, x + 220, y + 29, 18, 18, 5);
	ctx.fillStyle = C.blue;
	ctx.fill();
	icon(ctx, "check", x + 221, y + 30, 16, "#fff", 1.8);
}

function btn(ctx, x, y, w, h, label, { icon: ic, bg = "#fff", color = C.ink, border = C.border, size = 14 } = {}) {
	rr(ctx, x, y, w, h, 6);
	ctx.fillStyle = bg;
	ctx.fill();
	if (border) {
		ctx.strokeStyle = border;
		ctx.lineWidth = 1;
		ctx.stroke();
	}
	const lw = label ? tw(ctx, label, size, 500) : 0;
	const total = (ic ? 16 : 0) + (ic && label ? 8 : 0) + lw;
	let cx = x + (w - total) / 2;
	if (ic) {
		icon(ctx, ic, cx, y + h / 2 - 8, 16, color);
		cx += 24;
	}
	if (label) text(ctx, label, ic ? cx : cx, y + h / 2 + 0.5, { size, weight: 500, color });
}

function line(ctx, x1, y1, x2, y2, color = C.border) {
	ctx.beginPath();
	ctx.moveTo(x1, y1 + 0.5);
	ctx.lineTo(x2, y2 + 0.5);
	ctx.strokeStyle = color;
	ctx.lineWidth = 1;
	ctx.stroke();
}

// painel "Publicar produto" que desliza do botão ↪ com o preço de drop; fecha no clique em Publicar
const PANEL = { w: 330, h: 222 };
const CONFIRM_BTN = (x, y) => ({ x: x + ERP.w - 18 - 55, y: y + ERP.h + 14 + PANEL.h - 18 - 18 });
function publishPanel(ctx, t, x, y) {
	const k = g(t, T.press);
	const out = 1 - g(t, T.published, 0.4);
	if (k <= 0 || out <= 0) return;
	const { w, h } = PANEL;
	const px = x + ERP.w - w, py = y + ERP.h + 14;
	ctx.save();
	ctx.globalAlpha *= out;
	// cresce a partir do botão
	const ox = x + 512, oy = y + 330;
	ctx.translate(ox, oy);
	ctx.scale(lerp(0.12, 1, k), lerp(0.12, 1, k));
	ctx.translate(-ox, -oy + lerp(-40, 0, k));
	card(ctx, px, py, w, h, { r: 10, lift: 1.4 });
	const c = back(t, T.press);
	ctx.globalAlpha *= c;
	text(ctx, "Publicar produto", px + 18, py + 26, { size: 15, weight: 600 });
	text(ctx, "Preço de custo (drop)", px + 18, py + 56, { size: 13, color: C.ink2, weight: 500 });
	rr(ctx, px + 18, py + 72, w - 36, 42, 7);
	ctx.fillStyle = "#fff";
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = C.blue;
	ctx.stroke();
	text(ctx, "R$", px + 32, py + 93.5, { size: 13, color: C.ink3 });
	text(ctx, "49,90", px + 56, py + 93.5, { size: 15, weight: 600 });
	text(ctx, "Preço cobrado pelo fornecedor no dropshipping", px + 18, py + 134, { size: 11.5, color: C.ink3, weight: 400 });
	btn(ctx, px + w - 18 - 110, py + h - 18 - 36, 110, 36, "Publicar", { bg: C.blue, color: "#fff", border: null });
	ctx.restore();
}

// toast "Adicionado ao catálogo!" (print 06b), acento teal
function toast(ctx, t, x, y) {
	const k = g(t, T.published);
	const out = 1 - g(t, T.lift);
	if (k <= 0 || out <= 0) return;
	const w = 372, h = 72;
	ctx.save();
	ctx.globalAlpha *= out * clamp(k * 2);
	const yy = y + lerp(24, 0, k);
	card(ctx, x, yy, w, h, { r: 10, lift: 1.3 });
	rr(ctx, x + 8, yy + 10, 4, h - 20, 2);
	ctx.fillStyle = C.teal;
	ctx.fill();
	icon(ctx, "info", x + 24, yy + 18, 18, C.teal, 1.7);
	text(ctx, "Adicionado ao catálogo!", x + 54, yy + 27, { size: 15, weight: 500 });
	text(ctx, "Acesse o catálogo para ver", x + 54, yy + 48, { size: 13, color: C.ink3, weight: 400 });
	pill(ctx, "Abrir catálogo", x + w - 14, yy + 36, { bg: C.tealSoft, fg: C.teal, size: 12.5, weight: 500, h: 28, pad: 10, align: "right" });
	ctx.restore();
}

// ---------- legenda ----------
// cada legenda é uma lista de trechos; trecho em array sai na cor de destaque
const FIRST = ["Seu estoque no ", ["ERP"]];
const CAPS = [
	[0, FIRST],
	[T.press - REACH, ["Publique no ", ["catálogo"]]],
	[T.anunciar - REACH, ["Revendedores ", ["anunciam"], " por você"]],
	[T.sale[0], ["Todas as vendas ", ["num só lugar"]]],
	[T.toStock, ["O estoque ", ["baixa sozinho"]]],
	[T.toDesk, ["Você embala e ", ["envia"]]],
	[T.repasse[0], ["Você recebe na ", ["carteira", C.teal]]],
	[T.end, null],
	[T.back, FIRST],
];
const CAP = { size: 70, track: -2, y: 128 };
function captionLine(ctx, segs, y) {
	ctx.font = `600 ${CAP.size}px Inter`;
	ctx.letterSpacing = `${CAP.track}px`;
	const parts = segs.map((s) => (typeof s === "string" ? [s, C.ink] : [s[0], s[1] ?? C.blue]));
	const ws = parts.map(([s]) => ctx.measureText(s).width);
	let x = (S - ws.reduce((a, v) => a + v, 0)) / 2;
	parts.forEach(([s, color], i) => {
		text(ctx, s, x, y, { size: CAP.size, weight: 600, color, track: CAP.track });
		x += ws[i];
	});
}
function caption(ctx, t) {
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	let i = 0;
	while (i + 1 < CAPS.length && t >= CAPS[i + 1][0]) i++;
	const [t0, cur] = CAPS[i];
	const prev = i > 0 ? CAPS[i - 1][1] : null;
	const draw = (segs, a, dy) => {
		if (a <= 0 || !segs) return;
		ctx.globalAlpha = a;
		captionLine(ctx, segs, CAP.y + dy);
	};
	if (i > 0 && t < t0 + 0.8) {
		draw(prev, front(t, t0), -14 * (1 - front(t, t0)));
		draw(cur, back(t, t0), 14 * (1 - back(t, t0)));
	} else draw(cur, 1, 0);
	ctx.globalAlpha = 1;
}

// ---------- catálogo (/app/drop/loja, prints 14 e 14b) ----------
const CARD = { w: 265, h: 424 };
const LOJA = { x: CAT.x - 590, y: -330, w: 1180, h: 700 };
const GX = LOJA.x + 35, GY = LOJA.y + 120, STEP = 282, ROW = 442;
const SLOT = { x: GX, y: GY }; // o nosso card entra no primeiro lugar de "Em destaque"
const OTHERS = [
	["r10", "CORRENTE AÇO CARTIER PRATA", "Joias e Relógios", "R$ 14,90"],
	["r11", "Tênis Casual Lona Classic Ab Star", "Esportes e Fitness", "R$ 44,90"],
	["r12", "Revitalizador plástico automotivo premium", "Acessórios para Veículos", "R$ 29,99"],
	["r13", "Cadarço Redondo Listrado 120 CM", "Arte, Papelaria e Armarinho", "R$ 5,00"],
	["r20", "Caneca Porcelana Por Favor Aguarde…", "", ""],
	["r21", "Chinelo Feminino Nuvem Ortopédico…", "", ""],
	["r22", "CORRENTE CARTIER DOURADO", "", ""],
];

function wrap(ctx, s, max, size, weight) {
	const out = [];
	let cur = "";
	for (const w of s.split(" ")) {
		const n = cur ? cur + " " + w : w;
		if (tw(ctx, n, size, weight) > max && cur) {
			out.push(cur);
			cur = w;
		} else cur = n;
	}
	out.push(cur);
	return out;
}

// conteúdo do card do catálogo, sem moldura e sem foto
function catalogBody(ctx, x, y, { title, cat, price, ours }) {
	wrap(ctx, title, CARD.w - 30, 14, ours ? 600 : 500).slice(0, 2).forEach((l, i) =>
		text(ctx, l, x + 15, y + 217 + i * 20, { size: 14, weight: ours ? 600 : 500 }),
	);
	if (cat) text(ctx, cat, x + 15, y + 240 + (wrap(ctx, title, CARD.w - 30, 14, 500).length > 1 ? 20 : 0), { size: 12, color: C.ink3, weight: 400 });
	if (!price) return;
	text(ctx, price, x + 15, y + 297, { size: 16, weight: 700 });
	chip(ctx, "Original", x + CARD.w - 15 - tw(ctx, "Original", 12, 500) - 14, y + 279, { bg: "#f5f7fa", border: "transparent" });
	rr(ctx, x + 15, y + 316, CARD.w - 30, 46, 6);
	ctx.fillStyle = "#f7f9fb";
	ctx.fill();
	text(ctx, "Anúncios", x + 23, y + 339, { size: 11, color: C.ink3, weight: 400 });
	ctx.save();
	ctx.globalAlpha *= 0.6;
	ctx.drawImage(IMG.symbol, x + 101, y + 330, 17, 20);
	ctx.restore();
	text(ctx, "Ainda não anunciado", x + 128, y + 339, { size: 12, color: C.ink2, weight: 400 });
	rr(ctx, x + 15, y + 374, 192, 36, 6);
	ctx.fillStyle = C.blue;
	ctx.fill();
	text(ctx, "Anunciar", x + 111, y + 392.5, { size: 14, weight: 500, color: "#fff", align: "center" });
	rr(ctx, x + 215, y + 374, 36, 36, 6);
	ctx.fillStyle = C.blueSoft;
	ctx.fill();
	cartIcon(ctx, x + 225, y + 384, 16, C.blue);
}

function cartIcon(ctx, x, y, s, color) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s / 16, s / 16);
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.5;
	ctx.lineJoin = ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(1, 2);
	ctx.lineTo(3.5, 2);
	ctx.lineTo(5, 10.5);
	ctx.lineTo(13, 10.5);
	ctx.lineTo(14.5, 4.5);
	ctx.lineTo(4, 4.5);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(6, 13.5, 1.1, 0, 7);
	ctx.arc(12, 13.5, 1.1, 0, 7);
	ctx.fillStyle = color;
	ctx.fill();
	ctx.restore();
}

function lojaPage(ctx, t, a) {
	if (a <= 0) return;
	ctx.save();
	ctx.globalAlpha *= a;
	card(ctx, LOJA.x, LOJA.y, LOJA.w, LOJA.h, { r: 12, lift: 0.6 });
	const { x, y, w } = LOJA;
	rr(ctx, x + 32, y + 18, 28, 28, 6);
	ctx.strokeStyle = C.border;
	ctx.stroke();
	icon(ctx, "box", x + 38, y + 24, 16, C.blue);
	text(ctx, "Dropshipping", x + 72, y + 32.5, { size: 12.5, color: C.ink2, weight: 400 });
	icon(ctx, "chevron", x + 154, y + 28, 10, C.ink3);
	text(ctx, "Catálogo", x + 170, y + 32.5, { size: 15, weight: 600 });
	rr(ctx, x + 280, y + 16, 384, 32, 6);
	ctx.strokeStyle = C.border;
	ctx.stroke();
	text(ctx, "Buscar produtos", x + 312, y + 32.5, { size: 14, color: C.ink3, weight: 400 });
	btn(ctx, x + 710, y + 16, 126, 32, "Categorias", {});
	btn(ctx, x + 842, y + 16, 96, 32, "Filtros", {});
	btn(ctx, x + 944, y + 16, 84, 32, "Tour", { bg: C.blueSoft, color: C.blue, border: null });
	btn(ctx, x + 1034, y + 16, 110, 32, "Carrinho", { color: "#b3bcc8" });
	line(ctx, x, y + 64, x + w, y + 64);
	text(ctx, "Em destaque", x + 32, y + 100, { size: 21, weight: 700 });
	// grade: as outras peças de outros fornecedores; a 1ª posição é do nosso card
	ctx.save();
	rr(ctx, x, y + 64, w, LOJA.h - 64, [0, 0, 12, 12]);
	ctx.clip();
	OTHERS.forEach(([key, title, cat, price], i) => {
		const j = i + 1, cx = GX + (j % 4) * STEP, cy = GY + Math.floor(j / 4) * ROW;
		card(ctx, cx, cy, CARD.w, CARD.h, { r: 10, lift: 0.4 });
		photo(ctx, IMG[key], cx + 1, cy + 1, CARD.w - 2, 192, [9, 9, 0, 0]);
		line(ctx, cx, cy + 193, cx + CARD.w, cy + 193);
		catalogBody(ctx, cx, cy, { title, cat, price });
	});
	ctx.restore();
	ctx.restore();
}

// ---------- o card do produto: linha do ERP → card do catálogo → cópias nas vitrines ----------
function productCard(ctx, t) {
	if (t < T.lift) return;
	const lk = g(t, T.lift), pk = g(t, T.pan);
	// posição: centro em SUP enquanto levanta; viaja pela linha até o slot
	const erpX = SUP.x - ERP.w / 2, erpY = SUP.y - ERP.h / 2;
	const liftX = SUP.x - CARD.w / 2, liftY = SUP.y - CARD.h / 2 - 10;
	const x = lerp(lerp(erpX, liftX, lk), SLOT.x, pk);
	const y = lerp(lerp(erpY, liftY, lk), SLOT.y, pk);
	const w = lerp(ERP.w, CARD.w, lk), h = lerp(ERP.h, CARD.h, lk);
	const lift = 1 + 1.2 * Math.sin(Math.PI * clamp(lk * 0.5 + pk * 0.5));
	const gone = back(t, T.pull);
	if (gone >= 1) return;
	ctx.save();
	ctx.globalAlpha *= 1 - gone;
	card(ctx, x, y, w, h, { r: 10, lift });
	ctx.save();
	rr(ctx, x, y, w, h, 10);
	ctx.clip();
	// conteúdo do ERP some na primeira metade do glide
	const ea = front(t, T.lift);
	if (ea > 0) {
		ctx.globalAlpha *= ea;
		erpCard(ctx, t, x, y, 1);
		ctx.globalAlpha /= ea;
	}
	// foto: um objeto só, do quadro 112 do ERP ao topo do card
	const ph = [lerp(x + 17, x + 1, lk), lerp(y + 62, y + 1, lk), lerp(110, w - 2, lk), lerp(110, 192, lk)];
	photo(ctx, IMG.shoe, ...ph, lerp(7, 9, lk));
	const ca = back(t, T.lift);
	if (ca > 0) {
		ctx.globalAlpha *= ca;
		line(ctx, x, y + 193, x + w, y + 193);
		rr(ctx, x + 11, y + 11, 26, 26, 6);
		ctx.fillStyle = "#fff";
		ctx.fill();
		ctx.strokeStyle = C.border;
		ctx.stroke();
		rr(ctx, x + 18, y + 18, 12, 12, 3);
		ctx.strokeStyle = "#9aa4b2";
		ctx.stroke();
		catalogBody(ctx, x, y, { title: TITLE, cat: "", price: "R$ 49,90", ours: true });
		// selo teal de publicado
		pill(ctx, "Publicado", x + w - 12, y + 24, { align: "right", size: 11.5, h: 22 });
	}
	ctx.restore();
	ctx.restore();
}

// ---------- o estoque no meio (/app/erp/estoque, print 07) ----------
const ROWS = { x: MID.x - 300, y: MID.y - 52, w: 600, h: 104 };
const STOCK_AT = { x: ROWS.x + ROWS.w - 196, y: ROWS.y + 66 };
function stockRow(ctx, t) {
	const a = back(t, T.pan) * front(t, T.repasse[0]);
	if (a <= 0) return;
	const { x, y, w, h } = ROWS;
	ctx.save();
	ctx.globalAlpha *= a;
	card(ctx, x, y, w, h, { r: 10, lift: 0.8 });
	rr(ctx, x + 16, y + 16, 72, 72, 8);
	ctx.strokeStyle = C.border;
	ctx.stroke();
	photo(ctx, IMG.shoe, x + 17, y + 17, 70, 70, 7);
	ctx.beginPath();
	ctx.arc(x + 84, y + 20, 5, 0, 7);
	ctx.fillStyle = "#10b981";
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = "#fff";
	ctx.stroke();
	text(ctx, TITLE, x + 104, y + 30, { size: 14, weight: 500 });
	pill(ctx, "Produto simples", x + 104, y + 70, { bg: C.blueSoft, fg: C.blue, size: 12, weight: 500, h: 22, pad: 7 });
	ctx.beginPath();
	ctx.arc(x + 224, y + 70, 2, 0, 7);
	ctx.fillStyle = C.ink3;
	ctx.fill();
	icon(ctx, "calendar", x + 234, y + 64, 12, C.ink3, 1.2);
	text(ctx, "17/09/2026", x + 250, y + 70.5, { size: 12, color: C.ink3, weight: 400 });
	line(ctx, x + 384, y + 18, x + 384, y + h - 18);
	text(ctx, "Estoque", STOCK_AT.x, y + 38, { size: 14, color: C.ink3, weight: 400 });
	icon(ctx, "chevron", x + w - 26, y + h / 2 - 7, 14, C.ink3);
	ctx.restore();
	// o número: a mesma quantidade que saiu do chip do ERP
	const n = [39, 38, 37, 36, 35];
	ctx.save();
	ctx.globalAlpha *= clamp(a * 1.5);
	swapNum(ctx, t, T.unit, n, STOCK_AT.x, STOCK_AT.y, { size: 30, weight: 700, track: -0.6 }, (v) => `${v} unidades`);
	ctx.restore();
}

// o chip "Estoque: 39" desgruda do card, desce até a linha e desliza por ela até o meio
function stockTraveler(ctx, t) {
	if (t < T.lift || t > T.pan + 0.8) return;
	const lk = g(t, T.lift), pk = g(t, T.pan);
	const erpX = SUP.x - ERP.w / 2, erpY = SUP.y - ERP.h / 2;
	const w0 = tw(ctx, "Estoque: 39", 12, 500) + 14;
	const sx = erpX + 140 + tw(ctx, "Simples", 12, 500) + 22, sy = erpY + 153;
	const lx = SUP.x + CARD.w / 2 + 24, ly = -11;
	const x = lerp(lerp(sx, lx, lk), STOCK_AT.x, pk), y = lerp(lerp(sy, ly, lk), STOCK_AT.y - 11, pk);
	ctx.save();
	ctx.globalAlpha *= 1 - back(t, T.pan);
	card(ctx, x, y, w0, 22, { r: 5, fill: "#f5f7fa", lift: 0.5 * Math.sin(Math.PI * clamp(lk * 0.5 + pk * 0.5)) + 0.01 });
	text(ctx, "Estoque:", x + 7, y + 11.5, { size: 12, weight: 500, color: C.ink2 });
	text(ctx, "39", x + 7 + tw(ctx, "Estoque: ", 12, 500), y + 11.5, { size: 12, weight: 600 });
	ctx.restore();
}

// ---------- vitrines dos revendedores ----------
// ponytail: preços das vitrines são provisórios até o Pedro confirmar
const SHOPS = [
	["tiktok", "TikTok Shop", "R$ 89,90"],
	["shein", "Shein", "R$ 94,90"],
	["shopify", "Shopify", "R$ 99,90"],
	["nuvem", "Nuvemshop", "R$ 104,90"],
];
const SF = (i) => ({ x: CAT.x - 820 + i * 420, y: -300, w: 380, h: 580 });
const SALE_OF = [0, 2, 1]; // vitrines que vendem, na ordem das batidas
const ROW_OF_SHOP = { 0: 0, 2: 2, 1: 3 }; // linha da venda no /app/vendas

function storefront(ctx, t, i) {
	const a = back(t, T.pull) * front(t, T.toStock);
	if (a <= 0) return;
	const f = SF(i);
	const [key, name, price] = SHOPS[i];
	ctx.save();
	ctx.globalAlpha *= a;
	card(ctx, f.x, f.y, f.w, f.h, { r: 12 });
	rr(ctx, f.x + 16, f.y + 14, 32, 32, 8);
	ctx.strokeStyle = C.border;
	ctx.stroke();
	logo(ctx, key, f.x + 32, f.y + 30, 20);
	text(ctx, name, f.x + 60, f.y + 30.5, { size: 16, weight: 600 });
	line(ctx, f.x, f.y + 60, f.x + f.w, f.y + 60);
	ctx.restore();
}

// cópias do card voando da grade para cada vitrine
function storefrontProduct(ctx, t, i) {
	if (t < T.pull || t > T.toStock + 0.4) return;
	const k = g(t, T.pull);
	const f = SF(i);
	const [, , price] = SHOPS[i];
	const from = [SLOT.x + 1, SLOT.y + 1, CARD.w - 2, 192];
	const to = [f.x + 16, f.y + 76, f.w - 32, 280];
	const ph = from.map((v, j) => lerp(v, to[j], k));
	ctx.save();
	ctx.globalAlpha *= front(t, T.toStock);
	photo(ctx, IMG.shoe, ...ph, lerp(9, 8, k));
	ctx.restore();
	const a = back(t, T.pull) * front(t, T.toStock);
	if (a <= 0) return;
	ctx.save();
	ctx.globalAlpha *= a;
	wrap(ctx, TITLE, f.w - 32, 17, 500).forEach((l, j) => text(ctx, l, f.x + 16, f.y + 386 + j * 24, { size: 17, weight: 500 }));
	text(ctx, price, f.x + 16, f.y + 450, { size: 28, weight: 700 });
	const bx = [f.x + 16, f.y + 500, f.w - 32, 56, 8];
	rr(ctx, ...bx);
	ctx.fillStyle = C.ink;
	ctx.fill();
	const si = SALE_OF.indexOf(i);
	const st = si >= 0 ? T.sale[si] : Infinity;
	const fk = clamp((t - st) / 0.4);
	flood(ctx, bx, f.x + f.w / 2, f.y + 528, fk, C.blue);
	text(ctx, fk > 0.5 ? "Vendido" : "Comprar", f.x + f.w / 2, f.y + 528.5, { size: 18, weight: 600, color: "#fff", align: "center" });
	ctx.restore();
}

// ---------- vendas do fornecedor (/app/vendas, print 09) que viram a mesa de envios (/app/erp/envios, prints 10 e 11) ----------
const VP = { x: SUP.x - 300, y: -260, w: 600, h: 520 };
const VROW = (i) => VP.y + 76 + i * 104;
const VROWS = [
	["tiktok", "TikTok Shop", true],
	["shopee", "Shopee", false],
	["shopify", "Shopify", true],
	["shein", "Shein", true],
];
const OWN = { ml: { x: VP.x - 70, y: -40 }, shopee: { x: VP.x - 70, y: 40 } };
const LABEL = (i) => ({ x: VP.x + 20 + i * 142, y: VP.y + 246, w: 134, h: 250 });

function salePath(i) {
	// da vitrine até a linha da venda, por baixo do estoque
	const si = SALE_OF[i], f = SF(si), row = ROW_OF_SHOP[si];
	const lane = 360 + i * 26, x0 = f.x + f.w / 2, ry = VROW(row) + 46;
	const vx = -470 - i * 18;
	return [[x0, f.y + f.h], [x0, lane], [vx, lane], [vx, ry], [VP.x + VP.w, ry]];
}

function panel(ctx, t) {
	const a = back(t, T.sale[0]) * front(t, T.end);
	if (a <= 0) return;
	const { x, y, w, h } = VP;
	ctx.save();
	ctx.globalAlpha *= a;
	card(ctx, x, y, w, h, { r: 12, lift: 0.8 });
	rr(ctx, x + 20, y + 16, 28, 28, 6);
	ctx.strokeStyle = C.border;
	ctx.stroke();
	const d = g(t, T.toDesk);
	// cabeçalho troca de Vendas para Controle de Envios no glide
	ctx.save();
	ctx.globalAlpha *= front(t, T.toDesk);
	cartIcon(ctx, x + 26, y + 22, 16, C.blue);
	text(ctx, "Marketplaces", x + 60, y + 30.5, { size: 12.5, color: C.ink2, weight: 400 });
	icon(ctx, "chevron", x + 142, y + 26, 10, C.ink3);
	text(ctx, "Vendas", x + 158, y + 30.5, { size: 15, weight: 600 });
	ctx.restore();
	const da = back(t, T.toDesk);
	if (da > 0) {
		ctx.save();
		ctx.globalAlpha *= da;
		icon(ctx, "scan", x + 26, y + 22, 16, C.blue);
		text(ctx, "ERP", x + 60, y + 30.5, { size: 12.5, color: C.ink2, weight: 400 });
		icon(ctx, "chevron", x + 88, y + 26, 10, C.ink3);
		text(ctx, "Controle de Envios", x + 104, y + 30.5, { size: 15, weight: 600 });
		scanBlock(ctx, t, x + 16, y + 76, w - 32, 150);
		ctx.restore();
	}
	line(ctx, x, y + 60, x + w, y + 60);
	ctx.restore();
	// canais próprios, à esquerda do painel
	for (const [key, p] of Object.entries(OWN)) {
		ctx.save();
		ctx.globalAlpha *= a * front(t, T.toDesk);
		card(ctx, p.x - 24, p.y - 24, 48, 48, { r: 10, lift: 0.5 });
		logo(ctx, key, p.x, p.y, 28);
		ctx.restore();
	}
}

function scanBlock(ctx, t, x, y, w, h) {
	rr(ctx, x, y, w, h, 10);
	ctx.strokeStyle = "#cfe3f0";
	ctx.lineWidth = 1.5;
	ctx.stroke();
	rr(ctx, x + 18, y + 18, 28, 28, 6);
	ctx.strokeStyle = C.border;
	ctx.lineWidth = 1;
	ctx.stroke();
	icon(ctx, "scan", x + 24, y + 24, 16, C.ink2);
	text(ctx, "Escanear Código", x + 58, y + 32.5, { size: 16, weight: 600 });
	pill(ctx, "Pronto para escanear", x + w - 18, y + 32, { bg: C.blueSoft, fg: C.blue, size: 12, h: 26, pad: 12, align: "right" });
	rr(ctx, x + 18, y + 66, w - 36 - 140, 42, 7);
	ctx.strokeStyle = C.border;
	ctx.stroke();
	icon(ctx, "scan", x + 30, y + 79, 16, "#8fbcd8");
	text(ctx, "Aguardando bipagem ou digite manualmente...", x + 54, y + 87.5, { size: 13, color: C.ink3, weight: 400 });
	// botão Escanear: o cursor aperta aqui
	const bx = [x + w - 18 - 128, y + 66, 128, 42, 7];
	rr(ctx, ...bx);
	ctx.fillStyle = C.blue;
	ctx.fill();
	icon(ctx, "scan", bx[0] + 18, y + 79, 16, "#fff");
	text(ctx, "Escanear", bx[0] + 42, y + 87.5, { size: 14, weight: 600, color: "#fff" });
	text(ctx, "Plataforma de envio: Dogama", x + 18, y + 130, { size: 12, color: C.ink3, weight: 400 });
}
const SCAN_BTN = () => ({ x: VP.x + 16 + (VP.w - 32) - 18 - 64, y: VP.y + 76 + 87 });

// a venda: linha do /app/vendas que dobra em etiqueta na mesa
function saleItem(ctx, t, i, key, name, drop) {
	const at = T.arrive[i];
	const k = g(t, at - 0.2, 0.5);
	if (k <= 0) return;
	const fold = g(t, T.toDesk);
	const L = LABEL(i);
	const rx = VP.x + 16, ry = VROW(i) + lerp(-14, 0, k), rw = VP.w - 32, rh = 92;
	const x = lerp(rx, L.x, fold), y = lerp(ry, L.y, fold), w = lerp(rw, L.w, fold), h = lerp(rh, L.h, fold);
	// a etiqueta vira chip de repasse (só as de drop) e some no fim
	const ri = [0, -1, 1, 2][i];
	const out = ri >= 0 ? back(t, T.repasse[ri]) * 0.75 : 0;
	ctx.save();
	ctx.globalAlpha *= k * (1 - out) * front(t, T.end);
	card(ctx, x, y, w, h, { r: 10, lift: 0.5 + fold * 0.4 });
	ctx.save();
	rr(ctx, x, y, w, h, 10);
	ctx.clip();
	// foto: mesmo objeto nos dois estados
	const ph = [lerp(x + 12, x + 12, fold), lerp(y + 12, y + 12, fold), lerp(68, w - 24, fold), lerp(68, 84, fold)];
	rr(ctx, ph[0] - 0.5, ph[1] - 0.5, ph[2] + 1, ph[3] + 1, 8);
	ctx.strokeStyle = C.border;
	ctx.stroke();
	photo(ctx, IMG.shoe, ...ph, 7);
	const ra = front(t, T.toDesk);
	if (ra > 0) {
		ctx.globalAlpha *= ra;
		text(ctx, TITLE, x + 94, y + 32, { size: 14, weight: 500 });
		ctx.drawImage(IMG[key], x + 94, y + 51, 16, 16);
		text(ctx, name, x + 116, y + 59.5, { size: 12.5, color: C.ink2, weight: 400 });
		if (drop) dropTag(ctx, x + w - 136, y + 59);
		const pw = tw(ctx, "Pago", 12, 600) + 18;
		const pb = [x + w - 12 - pw, y + 48, pw, 22, 11];
		rr(ctx, ...pb);
		ctx.fillStyle = "#f1f4f7";
		ctx.fill();
		const pk = clamp((t - at) / 0.4);
		flood(ctx, pb, pb[0], pb[1] + 11, pk, C.tealSoft);
		text(ctx, "Pago", pb[0] + 9, pb[1] + 11.5, { size: 12, weight: 600, color: mixc("#9aa4b2", C.teal, pk) });
		ctx.globalAlpha /= ra;
	}
	const la = back(t, T.toDesk);
	if (la > 0) {
		ctx.globalAlpha *= la;
		ctx.drawImage(IMG[key], x + 12, y + 108, 16, 16);
		text(ctx, name, x + 34, y + 116.5, { size: 12, color: C.ink2, weight: 500 });
		// código de barras da etiqueta
		ctx.fillStyle = C.ink;
		let bx = x + 12;
		for (let j = 0; bx < x + w - 14; j++) {
			const bw = [1, 2, 1, 3, 1, 1, 2][j % 7];
			ctx.fillRect(bx, y + 136, bw, 34);
			bx += bw + [2, 1, 3, 1, 2][j % 5];
		}
		if (drop) dropTag(ctx, x + 12, y + 190);
		// pílula Pago (teal) desliza para Enviado (azul) sob um flood
		const sk = clamp((t - T.shipped[i]) / 0.4);
		const pb = [x + 12, y + 212, w - 24, 24, 12];
		rr(ctx, ...pb);
		ctx.fillStyle = C.tealSoft;
		ctx.fill();
		flood(ctx, pb, x + 12, y + 224, sk, C.blueSoft);
		ctx.save();
		rr(ctx, ...pb);
		ctx.clip();
		const e = ease(clamp((t - T.shipped[i]) / 0.4));
		const ga = ctx.globalAlpha;
		ctx.globalAlpha = ga * (1 - e);
		text(ctx, "Pago", x + 22, y + 224.5 - 10 * e, { size: 12, weight: 600, color: C.teal });
		ctx.globalAlpha = ga * e;
		text(ctx, "Enviado", x + 22, y + 224.5 + 10 * (1 - e), { size: 12, weight: 600, color: C.blue });
		ctx.restore();
	}
	ctx.restore();
	ctx.restore();
}

function dropTag(ctx, x, y) {
	const w = 56;
	rr(ctx, x, y - 11, w, 22, 6);
	ctx.fillStyle = C.blueSoft;
	ctx.fill();
	ctx.strokeStyle = "#9cc9e3";
	ctx.lineWidth = 1;
	ctx.stroke();
	icon(ctx, "box", x + 7, y - 6, 12, C.blue, 1.3);
	text(ctx, "Drop", x + 23, y + 0.5, { size: 12, weight: 600, color: C.blue });
}

// "Venda detectada!" (shipment_success_dialog)
function detected(ctx, t) {
	const k = g(t, T.scan, 0.4);
	const out = 1 - g(t, T.repasse[0] - 0.4, 0.4);
	if (k <= 0 || out <= 0) return;
	const w = 300, h = 64, x = VP.x + VP.w - w - 16, y = VP.y + 76 + 150 - h / 2 + lerp(10, 0, k);
	ctx.save();
	ctx.globalAlpha *= k * out;
	card(ctx, x, y, w, h, { r: 10, lift: 1.6 });
	rr(ctx, x + 8, y + 10, 4, h - 20, 2);
	ctx.fillStyle = C.blue;
	ctx.fill();
	ctx.beginPath();
	ctx.arc(x + 36, y + h / 2, 12, 0, 7);
	ctx.fillStyle = C.blueSoft;
	ctx.fill();
	icon(ctx, "check", x + 28, y + h / 2 - 8, 16, C.blue, 2);
	text(ctx, "Venda detectada!", x + 58, y + h / 2 + 0.5, { size: 15, weight: 600 });
	text(ctx, "Ver venda", x + w - 16, y + h / 2 + 0.5, { size: 13, weight: 500, color: C.blue, align: "right" });
	ctx.restore();
}

// ---------- carteira (/app/perfil?path=wallet, print 12) ----------
const WC = { x: WAL.x - 290, y: WAL.y - 110, w: 580, h: 220 };
const SALDO = ["R$ 0,00", "R$ 49,90", "R$ 99,80", "R$ 149,70"];
const arriveRep = (i) => T.repasse[i] + 0.8;

function wallet(ctx, t) {
	const a = back(t, T.repasse[0]);
	if (a <= 0 || t >= T.fold) return;
	const th = g(t, T.end); // afina numa linha
	const { x, y, w, h } = WC;
	const L = HEX_E * 6;
	const cw = lerp(w, L, th), ch = lerp(h, 2.5, th);
	const cx = WAL.x - cw / 2, cy = WAL.y - ch / 2;
	ctx.save();
	ctx.globalAlpha *= a;
	card(ctx, cx, cy, cw, ch, { r: lerp(12, 1.25, th), lift: 1 - th, fill: th > 0.6 ? mixc("#ffffff", C.blue, clamp((th - 0.6) / 0.4)) : C.card, border: th < 0.9 ? C.border : null });
	const ca = front(t, T.end);
	if (ca > 0) {
		ctx.globalAlpha *= ca;
		rr(ctx, x + 20, y + 18, 36, 36, 8);
		ctx.strokeStyle = C.border;
		ctx.stroke();
		icon(ctx, "wallet", x + 28, y + 26, 20, C.ink2);
		text(ctx, "Saldo na carteira", x + 70, y + 29, { size: 15, weight: 600 });
		text(ctx, "Gerencie suas finanças de maneira simples e eficiente", x + 70, y + 46, { size: 12, color: C.ink3, weight: 400 });
		line(ctx, x, y + 70, x + w, y + 70);
		text(ctx, "Seu saldo", x + 20, y + 96, { size: 14, color: C.ink3, weight: 400 });
		swapNum(ctx, t, [0, 1, 2].map(arriveRep), SALDO, x + 20, y + 138, { size: 38, weight: 700, track: -1 });
		text(ctx, "Ver financeiro", x + w - 40, y + 118, { size: 14, color: C.ink2, weight: 400, align: "right" });
		icon(ctx, "chevron", x + w - 34, y + 111, 14, C.ink2);
		btn(ctx, x + 20, y + 168, 150, 36, "Adicionar saldo", {});
		btn(ctx, x + 182, y + 168, 128, 36, "Sacar valor", { color: "#b3bcc8", bg: "#f5f7fa", border: null });
	}
	ctx.restore();
}

// chip teal "Repasse liberado" sobe da etiqueta até a carteira
function repasseChip(ctx, t, ri) {
	const i = [0, 2, 3][ri];
	const t0 = T.repasse[ri];
	const k = raw(t, t0);
	if (k <= 0 || t > t0 + 1.2) return;
	const L = LABEL(i);
	const x0 = L.x + L.w / 2, y0 = L.y + 20;
	const pts = [[x0, y0], [x0, WC.y + WC.h]];
	const at = flow(ctx, pts, { reveal: clamp(k * 1.6), alpha: 1 - clamp((t - t0 - 0.8) / 0.3), dot: -1 });
	if (k >= 1) return;
	const [px, py] = at(0) && (() => {
		let Ltot = 0;
		for (let j = 1; j < pts.length; j++) Ltot += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
		return at(Ltot * ease(k));
	})();
	const s = "Repasse liberado";
	const w = tw(ctx, s, 13, 600) + 22;
	ctx.save();
	ctx.globalAlpha *= clamp(k * 5) * (1 - clamp((k - 0.85) / 0.15));
	card(ctx, px - w / 2, py - 14, w, 28, { r: 14, fill: C.teal, border: null, lift: 1.2 });
	text(ctx, s, px, py + 0.5, { size: 13, weight: 600, color: "#fff", align: "center" });
	ctx.restore();
}

// ---------- fechamento: linha → hexágono → wordmark → card do ERP ----------
const HEX_E = 110;
// hexágono de ponta para cima, como o símbolo (viewBox 245 × 288)
const HEX = [0, 1, 2, 3, 4, 5].map((k) => {
	const a = -Math.PI / 2 + (k * Math.PI) / 3;
	return [Math.cos(a) * HEX_E, Math.sin(a) * HEX_E];
});

function hexPoly(t) {
	// dobra aresta por aresta: começa no vértice de cima à esquerda e cada aresta gira, em sequência, do horizontal ao seu ângulo
	const f = raw(t, T.fold);
	const start = [lerp(-3 * HEX_E, HEX[5][0], ease(f)), lerp(0, HEX[5][1], ease(f))];
	const pts = [start];
	for (let k = 0; k < 6; k++) {
		const [ax, ay] = HEX[(k + 5) % 6], [bx, by] = HEX[k];
		const target = Math.atan2(by - ay, bx - ax);
		const e = ease(clamp(f * 1.75 - k * 0.15));
		const d = lerp(0, target, e);
		const [px, py] = pts[pts.length - 1];
		pts.push([px + Math.cos(d) * HEX_E, py + Math.sin(d) * HEX_E]);
	}
	return pts.map(([x, y]) => [WAL.x + x, WAL.y + y]);
}

function ending(ctx, t) {
	if (t < T.fold) return;
	const up = g(t, T.back);
	// hexágono em linha, que preenche e vira o símbolo
	const fill = ease(clamp((t - T.fold - 0.55) / 0.3));
	const wk = g(t, T.word);
	const symX = WAL.x - lerp(0, 175, wk);
	const sh = 2 * HEX_E; // altura do símbolo
	if (up <= 0) {
		const pts = hexPoly(t).map(([x, y]) => [x - WAL.x + symX, y]);
		ctx.save();
		ctx.beginPath();
		pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
		ctx.strokeStyle = C.blue;
		ctx.lineWidth = lerp(2.5, 4, fill);
		ctx.lineJoin = "round";
		ctx.stroke();
		if (fill > 0) {
			ctx.globalAlpha = fill;
			const w = (sh * 245) / 288;
			ctx.drawImage(IMG.symbol, symX - w / 2, WAL.y - sh / 2, w, sh);
		}
		ctx.restore();
		// wordmark sai de trás do hexágono
		if (wk > 0) {
			const nh = 92, nw = (nh * IMG.name.width) / IMG.name.height;
			ctx.save();
			rr(ctx, symX + 90, WAL.y - 200, 1000, 400, 0);
			ctx.clip();
			ctx.globalAlpha = clamp(wk * 1.5);
			ctx.drawImage(IMG.name, lerp(symX - nw + 60, symX + 120, wk), WAL.y - nh / 2, nw, nh);
			ctx.restore();
			ctx.globalAlpha = back(t, T.word);
			text(ctx, "Seu estoque vendendo em todo o Brasil.", WAL.x, WAL.y + 190 + 10 * (1 - back(t, T.word)), { size: 34, weight: 600, color: C.ink2, align: "center", track: -0.6 });
			ctx.globalAlpha = 1;
		}
		return;
	}
	// desdobra no card do ERP, voltando com a câmera ao primeiro quadro
	const ex = SUP.x - ERP.w / 2, ey = SUP.y - ERP.h / 2;
	const R = [[ex + ERP.w / 2, ey], [ex + ERP.w, ey], [ex + ERP.w, ey + ERP.h], [ex + ERP.w / 2, ey + ERP.h], [ex, ey + ERP.h], [ex, ey]];
	const H = [0, 1, 2, 3, 4, 5].map((k) => [symX + HEX[k][0], WAL.y + HEX[k][1] * (sh / 2 / HEX_E)]);
	const P = H.map((p, k) => [lerp(p[0], R[k][0], up), lerp(p[1], R[k][1], up)]);
	ctx.save();
	ctx.globalAlpha = front(t, T.back);
	const nh = 92, nw = (nh * IMG.name.width) / IMG.name.height;
	ctx.drawImage(IMG.name, symX + 120, WAL.y - nh / 2, nw, nh);
	text(ctx, "Seu estoque vendendo em todo o Brasil.", WAL.x, WAL.y + 190, { size: 34, weight: 600, color: C.ink2, align: "center", track: -0.6 });
	ctx.restore();
	ctx.save();
	ctx.beginPath();
	P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
	ctx.closePath();
	ctx.fillStyle = mixc(C.blue, "#ffffff", clamp(up * 2));
	ctx.globalAlpha = 1 - back(t, T.back);
	ctx.shadowColor = `rgba(9,17,36,${0.08 * up})`;
	ctx.shadowBlur = 30 * up;
	ctx.fill();
	ctx.restore();
	// o card nasce por dentro no back half
	const ca = back(t, T.back);
	if (ca > 0) erpCard(ctx, 0, ex, ey, ca);
}

// ---------- quadro ----------
export function draw(ctx, t) {
	const cam = camera(CAMS, t);
	stage(ctx, cam);
	applyCam(ctx, cam);

	const ex = SUP.x - ERP.w / 2, ey = SUP.y - ERP.h / 2;

	// linha tracejada do fornecedor ao catálogo, passando pelo estoque
	const lr = g(t, T.lift);
	if (lr > 0) {
		const fade = front(t, T.sale[0]);
		flow(ctx, [[SUP.x + CARD.w / 2, 0], [ROWS.x, 0]], { reveal: lr, alpha: fade });
		flow(ctx, [[ROWS.x + ROWS.w, 0], [LOJA.x, 0]], { reveal: g(t, T.pan), alpha: fade });
	}
	// linhas das vitrines de volta ao fornecedor
	for (let i = 0; i < 3; i++) {
		const rv = g(t, T.pull + 0.4);
		if (rv <= 0) continue;
		const st = T.sale[i];
		const dk = clamp((t - st) / (T.arrive[[0, 2, 3][i]] - st));
		flow(ctx, salePath(i), { reveal: rv, dot: t >= st && dk < 1 ? ease(dk) : -1, alpha: front(t, T.toStock) });
	}
	// venda própria da Shopee no /app/vendas
	{
		const at = T.arrive[1], k = raw(t, at - 0.8);
		if (k > 0 && t < T.toStock + 0.8) {
			const ry = VROW(1) + 46;
			flow(ctx, [[OWN.shopee.x + 24, OWN.shopee.y], [VP.x - 10, OWN.shopee.y], [VP.x - 10, ry], [VP.x + 16, ry]], {
				reveal: clamp(k * 2),
				dot: k < 1 ? ease(k) : -1,
				alpha: front(t, T.toStock),
			});
		}
	}
	// cada venda tira uma unidade do mesmo número
	for (let i = 0; i < 4; i++) {
		const ry = VROW(i) + 46, u = T.unit[i], k = raw(t, u - 0.4, 0.4);
		if (t < T.toStock || t > T.toDesk + 0.8) continue;
		const lx = ROWS.x - 50 - (3 - i) * 12;
		flow(ctx, [[VP.x + VP.w, ry], [lx, ry], [lx, 0], [ROWS.x, 0]], {
			reveal: g(t, T.toStock),
			dot: k > 0 && k < 1 ? ease(k) : -1,
			alpha: front(t, T.toDesk),
		});
	}

	lojaPage(ctx, t, back(t, T.pan) * front(t, T.pull));
	stockRow(ctx, t);
	panel(ctx, t);
	VROWS.forEach((r, i) => saleItem(ctx, t, i, ...r));
	detected(ctx, t);
	wallet(ctx, t);
	for (let i = 0; i < 3; i++) repasseChip(ctx, t, i);
	for (let i = 0; i < 4; i++) storefront(ctx, t, i);
	for (let i = 0; i < 4; i++) storefrontProduct(ctx, t, i);
	if (t < T.lift) erpCard(ctx, t, ex, ey, 1);
	// venda própria da Shopee no ERP: do canal até o chip de estoque
	const sk = raw(t, T.shopee);
	if (sk > 0 && t < T.stock39 + 0.3) {
		const cx = ex + 140 + tw(ctx, "Simples", 12, 500) + 22 + 40;
		flow(ctx, [[ex + 278 + 36, ey + 222], [ex + 278 + 36, ey + 196], [cx, ey + 196], [cx, ey + 176]], {
			reveal: clamp(sk * 2),
			dot: sk < 1 ? ease(sk) : -1,
			alpha: 1 - clamp((t - T.stock39) / 0.3),
		});
	}
	publishPanel(ctx, t, ex, ey);
	toast(ctx, t, ex + ERP.w - 372, ey + ERP.h + 14); // no lugar do painel, longe da legenda
	productCard(ctx, t);
	stockTraveler(ctx, t);
	ending(ctx, t);

	const cur = cursorAt(t, cam);
	if (cur) {
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = cur.alpha;
		cursor(ctx, cur.x, cur.y, { press: cur.press });
	}
	ctx.globalAlpha = 1;
	caption(ctx, t);
}

// ---------- cursor: quatro cliques, em coordenadas de tela, preso ao botão que aperta ----------
// ↪ Publicar produto → Publicar do painel (mesmo gesto) → Anunciar no catálogo → Escanear
function cursorAt(t, cam) {
	const ex = SUP.x - ERP.w / 2, ey = SUP.y - ERP.h / 2;
	const toScreen = ([wx, wy]) => [S / 2 + (wx - cam.x) * cam.z, S / 2 + (wy - cam.y) * cam.z];
	const P = CONFIRM_BTN(ex, ey), B = SCAN_BTN();
	const target = [[ex + 514, ey + 332], [P.x, P.y], [SLOT.x + 111, SLOT.y + 392], [B.x, B.y]].map(toScreen);
	const until = [CLICKS[1] - REACH, T.published + 0.6, T.pull + 0.4, T.repasse[0] + 0.4];
	const fade = [Infinity, T.published + 0.2, T.pull, T.repasse[0]];
	const i = CLICKS.findIndex((c, j) => t >= c - REACH && t < until[j]);
	if (i < 0) return null;
	const k = g(t, CLICKS[i] - REACH);
	const from = i === 1 ? target[0] : [S + 60, S - 120];
	return {
		x: lerp(from[0], target[i][0], k),
		y: lerp(from[1], target[i][1], k),
		press: clamp(1 - Math.abs(t - CLICKS[i] - 0.06) / 0.08),
		alpha: front(t, fade[i]),
	};
}

// câmera e cursor por tempo, para a trilha sincronizar o som de movimento
export function motion(t) {
	const cam = camera(CAMS, t);
	return { cam, cur: cursorAt(t, cam) };
}
export { CLICKS };
