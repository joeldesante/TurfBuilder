import { describe, it, expect } from 'vitest';
import { indexCsvChunks, ROW_INDEX_INTERVAL } from './csv-index';

const encode = (text: string) => new TextEncoder().encode(text);

/** The text from a byte offset on, to check an offset really is where a row starts. */
function fromOffset(text: string, offset: number, length = 12): string {
	return new TextDecoder().decode(encode(text).slice(offset, offset + length));
}

/** The same bytes cut into pieces of a given size, as a stream would deliver them. */
function inPieces(text: string, size: number): Uint8Array[] {
	const bytes = encode(text);
	const pieces: Uint8Array[] = [];
	for (let i = 0; i < bytes.length; i += size) pieces.push(bytes.slice(i, i + size));
	return pieces;
}

describe('indexCsvChunks', () => {
	it('defaults to one entry per thousand rows', () => {
		expect(ROW_INDEX_INTERVAL).toBe(1000);
	});

	it('counts the rows under the header', async () => {
		const index = await indexCsvChunks([encode('a,b\n1,2\n3,4\n5,6\n')]);

		expect(index.rowCount).toBe(3);
	});

	it('starts the index at the first row under the header', async () => {
		const text = 'name,phone\nAda,555\nGrace,556\n';
		const index = await indexCsvChunks([encode(text)], 1);

		expect(index.offsets).toEqual([11, 19]);
		expect(fromOffset(text, 11, 3)).toBe('Ada');
		expect(fromOffset(text, 19, 5)).toBe('Grace');
	});

	it('records one offset per interval of rows, at the first row of each', async () => {
		const rows = Array.from({ length: 10 }, (_, i) => `row${i},x`);
		const text = ['h1,h2', ...rows, ''].join('\n');
		const index = await indexCsvChunks([encode(text)], 4);

		expect(index.rowCount).toBe(10);
		expect(index.offsets).toHaveLength(3);
		expect(fromOffset(text, index.offsets[0], 4)).toBe('row0');
		expect(fromOffset(text, index.offsets[1], 4)).toBe('row4');
		expect(fromOffset(text, index.offsets[2], 4)).toBe('row8');
	});

	it('has one entry per started interval: rowCount over interval, rounded up', async () => {
		for (const [rows, interval, entries] of [
			[0, 5, 0],
			[1, 5, 1],
			[5, 5, 1],
			[6, 5, 2],
			[10, 5, 2],
			[11, 5, 3]
		] as const) {
			const text = ['h', ...Array.from({ length: rows }, (_, i) => `r${i}`), ''].join('\n');
			const index = await indexCsvChunks([encode(text)], interval);
			expect(index.rowCount).toBe(rows);
			expect(index.offsets).toHaveLength(entries);
		}
	});

	it('counts a last row with no line break after it', async () => {
		const text = 'h\nr0\nr1';
		const index = await indexCsvChunks([encode(text)], 1);

		expect(index.rowCount).toBe(2);
		expect(index.offsets).toEqual([2, 5]);
	});

	it('handles CRLF line endings', async () => {
		const text = 'h1,h2\r\nr0,a\r\nr1,b\r\nr2,c\r\n';
		const index = await indexCsvChunks([encode(text)], 1);

		expect(index.rowCount).toBe(3);
		for (const [k, name] of ['r0', 'r1', 'r2'].entries()) {
			expect(fromOffset(text, index.offsets[k], 2)).toBe(name);
		}
	});

	it('handles lone carriage returns as line endings', async () => {
		const text = 'h\rr0\rr1\r';
		const index = await indexCsvChunks([encode(text)], 1);

		expect(index.rowCount).toBe(2);
		expect(fromOffset(text, index.offsets[1], 2)).toBe('r1');
	});

	it('does not end a row at a line break inside a quoted cell', async () => {
		const text = 'name,note\n"Ada","line one\nline two"\nGrace,plain\n';
		const index = await indexCsvChunks([encode(text)], 1);

		expect(index.rowCount).toBe(2);
		expect(fromOffset(text, index.offsets[1], 5)).toBe('Grace');
	});

	it('treats a doubled quote inside a quoted cell as a quote, not the end of the cell', async () => {
		const text = 'a,b\n"say ""hi""\nthere",x\nnext,y\n';
		const index = await indexCsvChunks([encode(text)], 1);

		expect(index.rowCount).toBe(2);
		expect(fromOffset(text, index.offsets[1], 4)).toBe('next');
	});

	it('does not count empty lines as rows', async () => {
		const text = 'h\n\nr0\n\n\nr1\n\n';
		const index = await indexCsvChunks([encode(text)], 1);

		expect(index.rowCount).toBe(2);
		expect(fromOffset(text, index.offsets[0], 2)).toBe('r0');
		expect(fromOffset(text, index.offsets[1], 2)).toBe('r1');
	});

	it('measures in bytes, so accented letters and emoji do not throw the offsets off', async () => {
		const text = 'nom\nÉléonore,é\n日本語,😀\nplain,x\n';
		const index = await indexCsvChunks([encode(text)], 1);

		expect(index.rowCount).toBe(3);
		expect(fromOffset(text, index.offsets[0], 8)).toContain('Éléon');
		expect(fromOffset(text, index.offsets[1], 9)).toContain('日本語');
		expect(fromOffset(text, index.offsets[2], 5)).toBe('plain');
	});

	it('gives the same answer however the file is cut into pieces', async () => {
		const text =
			'First Name,Last Name,Note\r\n' +
			Array.from({ length: 60 }, (_, i) =>
				i % 7 === 0
					? `Ada${i},"Love, lace","two\r\nlines é"`
					: i % 11 === 0
						? ''
						: `Grace${i},Hopper,"say ""hi"""`
			).join('\r\n') +
			'\r\n';
		const whole = await indexCsvChunks([encode(text)], 5);

		for (const size of [1, 2, 3, 5, 8, 13, 64, 1000]) {
			expect(await indexCsvChunks(inPieces(text, size), 5)).toEqual(whole);
		}
	});

	it('reads pieces from an async stream as well', async () => {
		async function* stream() {
			yield encode('h\nr0\n');
			yield encode('r1\n');
		}

		expect((await indexCsvChunks(stream(), 1)).rowCount).toBe(2);
	});

	it('has no rows and no offsets for an empty file or a header alone', async () => {
		expect(await indexCsvChunks([])).toEqual({ rowCount: 0, interval: 1000, offsets: [] });
		expect(await indexCsvChunks([encode('a,b,c\n')])).toEqual({
			rowCount: 0,
			interval: 1000,
			offsets: []
		});
	});

	it('works for a big file: 400,000 rows give 400 entries, in order', async () => {
		const header = 'First Name,Last Name,Sex,Phone\n';
		const rows = Array.from({ length: 400_000 }, (_, i) => `Ada,Lovelace,Female,555-${i}\n`);
		const index = await indexCsvChunks([encode(header + rows.join(''))]);

		expect(index.rowCount).toBe(400_000);
		expect(index.offsets).toHaveLength(400);
		expect(index.offsets[0]).toBe(header.length);
		expect(index.offsets.every((o, k) => k === 0 || o > index.offsets[k - 1])).toBe(true);
	});

	it('refuses an interval below 1', async () => {
		await expect(indexCsvChunks([], 0)).rejects.toThrow(RangeError);
	});
});
