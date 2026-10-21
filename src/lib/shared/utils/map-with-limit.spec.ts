import { describe, expect, it } from 'vitest';
import { mapWithLimit } from './map-with-limit';

const tick = () => new Promise((r) => setTimeout(r, 1));

describe('mapWithLimit', () => {
	it('keeps the input order', async () => {
		expect(await mapWithLimit([3, 1, 2], 2, async (n) => (await tick(), n * 10))).toEqual([30, 10, 20]);
	});

	it('never runs more than the limit at once', async () => {
		let running = 0;
		let peak = 0;
		await mapWithLimit(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
			running++;
			peak = Math.max(peak, running);
			await tick();
			running--;
		});

		expect(peak).toBe(3);
	});

	it('rejects with the first error', async () => {
		await expect(mapWithLimit([1, 2], 2, async (n) => { if (n === 2) throw new Error('two'); return n; })).rejects.toThrow('two');
	});

	it('handles an empty list', async () => {
		expect(await mapWithLimit([], 4, async (n) => n)).toEqual([]);
	});
});
