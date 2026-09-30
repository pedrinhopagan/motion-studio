// bun scenes/dogama-fornecedor/eventos.js > eventos.json
// Tempos e movimento (câmera e cursor a cada 1 ms) direto da cena, para o som nunca sair da grade da imagem.
import { T, CLICKS, motion } from "./scene.js";
import { DUR, ease } from "./core.js";

const R = 1000, cam = [], cur = [];
for (let i = 0; i < Math.round(DUR * R); i++) {
	const m = motion(i / R);
	cam.push([m.cam.x, m.cam.y, m.cam.z].map((v) => +v.toFixed(3)));
	cur.push(m.cur && [m.cur.x, m.cur.y, m.cur.alpha].map((v) => +v.toFixed(2)));
}
console.log(JSON.stringify({
	DUR, R, cam, cur, drop: T.sale[0],
	ease: Array.from({ length: 201 }, (_, i) => ease(i / 200)),
	click: CLICKS,
	sale: [T.sale[0]], // uma notificação só, na primeira venda (drop)
	tock: [T.stock39, ...T.unit, ...T.repasse.map((v) => v + 0.8)],
	swish: [T.lift, T.word],
}));
