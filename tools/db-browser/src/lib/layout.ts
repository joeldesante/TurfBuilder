import type { GraphFk, GraphTable } from './api';

export const NODE_W = 230;
export const HEADER = 26;
export const ROW = 16;

export const nodeHeight = (t: GraphTable) => HEADER + t.columns.length * ROW + 6;

export interface Point {
	x: number;
	y: number;
}

/**
 * Places tables with a small force simulation: overlapping boxes push apart,
 * foreign keys pull their tables together. Schemas start in separate bands so
 * the result is stable and readable.
 */
export function layout(tables: GraphTable[], fks: GraphFk[]): Record<string, Point> {
	const schemas = [...new Set(tables.map((t) => t.schema))];
	const counts: Record<string, number> = {};
	const pos: Record<string, Point> = {};

	for (const t of tables) {
		const i = (counts[t.schema] = (counts[t.schema] ?? -1) + 1);
		pos[t.key] = {
			x: schemas.indexOf(t.schema) * 1100 + (i % 4) * 300,
			y: Math.floor(i / 4) * 360
		};
	}

	const size = Object.fromEntries(tables.map((t) => [t.key, { w: NODE_W, h: nodeHeight(t) }]));
	const links = fks.filter((f) => f.from !== f.to);
	const keys = tables.map((t) => t.key);
	const ITERATIONS = 350;

	for (let step = 0; step < ITERATIONS; step++) {
		const cooling = 1 - step / ITERATIONS;
		const move: Record<string, Point> = Object.fromEntries(keys.map((k) => [k, { x: 0, y: 0 }]));

		for (const f of links) {
			const a = pos[f.from];
			const b = pos[f.to];
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const d = Math.hypot(dx, dy) || 1;
			const pull = ((d - 380) / d) * 0.04;
			move[f.from].x += dx * pull;
			move[f.from].y += dy * pull;
			move[f.to].x -= dx * pull;
			move[f.to].y -= dy * pull;
		}

		for (let i = 0; i < keys.length; i++) {
			for (let j = i + 1; j < keys.length; j++) {
				const a = pos[keys[i]];
				const b = pos[keys[j]];
				const sa = size[keys[i]];
				const sb = size[keys[j]];
				let dx = b.x + sb.w / 2 - (a.x + sa.w / 2);
				let dy = b.y + sb.h / 2 - (a.y + sa.h / 2);
				if (dx === 0 && dy === 0) dx = dy = 1;

				const d2 = dx * dx + dy * dy;
				const push = (60000 / d2) * cooling;
				const d = Math.sqrt(d2);
				move[keys[i]].x -= (dx / d) * push;
				move[keys[i]].y -= (dy / d) * push;
				move[keys[j]].x += (dx / d) * push;
				move[keys[j]].y += (dy / d) * push;

				const overlapX = (sa.w + sb.w) / 2 + 50 - Math.abs(dx);
				const overlapY = (sa.h + sb.h) / 2 + 40 - Math.abs(dy);
				if (overlapX > 0 && overlapY > 0) {
					if (overlapX < overlapY) {
						const s = (Math.sign(dx) * overlapX) / 2;
						move[keys[i]].x -= s;
						move[keys[j]].x += s;
					} else {
						const s = (Math.sign(dy) * overlapY) / 2;
						move[keys[i]].y -= s;
						move[keys[j]].y += s;
					}
				}
			}
		}

		for (const k of keys) {
			pos[k].x += move[k].x;
			pos[k].y += move[k].y;
		}
	}

	separate(keys, pos, size);
	return pos;
}

/** Final pass: nudge apart any boxes still overlapping until none do. */
function separate(
	keys: string[],
	pos: Record<string, Point>,
	size: Record<string, { w: number; h: number }>
) {
	const GAP_X = 40;
	const GAP_Y = 30;

	for (let pass = 0; pass < 500; pass++) {
		let moved = false;
		for (let i = 0; i < keys.length; i++) {
			for (let j = i + 1; j < keys.length; j++) {
				const a = pos[keys[i]];
				const b = pos[keys[j]];
				const sa = size[keys[i]];
				const sb = size[keys[j]];
				const dx = b.x + sb.w / 2 - (a.x + sa.w / 2);
				const dy = b.y + sb.h / 2 - (a.y + sa.h / 2);
				const overlapX = (sa.w + sb.w) / 2 + GAP_X - Math.abs(dx);
				const overlapY = (sa.h + sb.h) / 2 + GAP_Y - Math.abs(dy);
				if (overlapX <= 0 || overlapY <= 0) continue;

				moved = true;
				if (overlapX < overlapY) {
					const s = ((dx < 0 ? -1 : 1) * overlapX) / 2 + (dx < 0 ? -1 : 1);
					a.x -= s;
					b.x += s;
				} else {
					const s = ((dy < 0 ? -1 : 1) * overlapY) / 2 + (dy < 0 ? -1 : 1);
					a.y -= s;
					b.y += s;
				}
			}
		}
		if (!moved) return;
	}
}
