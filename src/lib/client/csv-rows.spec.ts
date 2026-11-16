import { describe, it, expect, vi, afterEach } from 'vitest';
import { indexCsvChunks } from '$lib/shared/utils/csv-index';
import { createCsvRowSource, fileReader, urlReader } from './csv-rows';

const encode = (text: string) => new TextEncoder().encode(text);

/** A CSV of `rows` people, a blank Sex now and then, with an index every `interval` rows. */
function makeCsv(rows: number) {
	const lines = ['First Name,Last Name,Sex'];
	for (let i = 0; i < rows; i++) {
		lines.push(
			i % 7 === 3
				? `Ada${i},"Love, lace ${i}","two\nlines é"`
				: `Name${i},Last${i},${i % 5 === 0 ? '' : 'Female'}`
		);
	}
	return lines.join('\n') + '\n';
}

async function setup(rows: number, interval = 10) {
	const text = makeCsv(rows);
	const bytes = encode(text);
	const index = await indexCsvChunks([bytes], interval);
	const read = vi.fn(async (start: number, end: number) => bytes.slice(start, end));
	const source = createCsvRowSource({
		columnCount: 3,
		rowCount: index.rowCount,
		index: { interval, offsets: index.offsets },
		size: bytes.length,
		read
	});
	return { source, read, index, text };
}

/** What a row should read as, to compare with what the source returns. */
const expected = (i: number) =>
	i % 7 === 3
		? [`Ada${i}`, `Love, lace ${i}`, 'two\nlines é']
		: [`Name${i}`, `Last${i}`, i % 5 === 0 ? '' : 'Female'];

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('createCsvRowSource', () => {
	it('reports how many rows the file has', async () => {
		expect((await setup(95)).source.rowCount).toBe(95);
	});

	it('returns the first rows', async () => {
		const { source } = await setup(95);

		expect(await source.loadRows(0, 4)).toEqual([0, 1, 2, 3].map(expected));
	});

	it('returns rows from the middle of a block', async () => {
		const { source } = await setup(95);

		expect(await source.loadRows(23, 5)).toEqual([23, 24, 25, 26, 27].map(expected));
	});

	it('returns rows that run across blocks', async () => {
		const { source } = await setup(95);

		expect(await source.loadRows(8, 15)).toEqual(
			Array.from({ length: 15 }, (_, i) => expected(8 + i))
		);
	});

	it('returns fewer rows at the end of the file, and none past it', async () => {
		const { source } = await setup(95);

		expect(await source.loadRows(90, 20)).toEqual([90, 91, 92, 93, 94].map(expected));
		expect(await source.loadRows(95, 20)).toEqual([]);
		expect(await source.loadRows(500, 20)).toEqual([]);
	});

	it('returns nothing for a negative offset or no rows asked for', async () => {
		const { source } = await setup(95);

		expect(await source.loadRows(-1, 5)).toEqual([]);
		expect(await source.loadRows(3, 0)).toEqual([]);
	});

	it('keeps quoted commas and line breaks and accented letters whole', async () => {
		const { source } = await setup(95);

		expect((await source.loadRows(3, 1))[0]).toEqual(['Ada3', 'Love, lace 3', 'two\nlines é']);
	});

	it('reads only the block it needs, as one range', async () => {
		const { source, read, index } = await setup(95);

		await source.loadRows(23, 5);

		expect(read).toHaveBeenCalledTimes(1);
		expect(read).toHaveBeenCalledWith(index.offsets[2], index.offsets[3]);
	});

	it('reads the last block up to the end of the file', async () => {
		const { source, read, text } = await setup(95);

		await source.loadRows(92, 3);

		expect(read.mock.calls[0][1]).toBe(encode(text).length);
	});

	it('never reads the whole file for a slice from the middle', async () => {
		const { source, read, text } = await setup(2000, 100);

		await source.loadRows(1234, 50);

		const [start, end] = read.mock.calls[0];
		expect(end - start).toBeLessThan(encode(text).length / 10);
	});

	it('does not read a block twice, whether asked again or by a neighbouring page', async () => {
		const { source, read } = await setup(95);

		await source.loadRows(20, 5);
		await source.loadRows(25, 5);
		await source.loadRows(20, 5);

		expect(read).toHaveBeenCalledTimes(1);
	});

	it('shares one read between asks made at the same time', async () => {
		const { source, read } = await setup(95);

		await Promise.all([source.loadRows(20, 3), source.loadRows(24, 3)]);

		expect(read).toHaveBeenCalledTimes(1);
	});

	it('tries a failed block again on the next ask', async () => {
		const { source, read } = await setup(95);
		read.mockRejectedValueOnce(new Error('network'));

		await expect(source.loadRows(0, 3)).rejects.toThrow('network');
		expect(await source.loadRows(0, 3)).toEqual([0, 1, 2].map(expected));
	});

	it('fills out a short row and cuts a long one to the header', async () => {
		const text = 'a,b,c\n1,2\n3,4,5,6\n';
		const bytes = encode(text);
		const index = await indexCsvChunks([bytes], 10);
		const source = createCsvRowSource({
			columnCount: 3,
			rowCount: index.rowCount,
			index: { interval: 10, offsets: index.offsets },
			size: bytes.length,
			read: async (s, e) => bytes.slice(s, e)
		});

		expect(await source.loadRows(0, 2)).toEqual([
			['1', '2', ''],
			['3', '4', '5']
		]);
	});

	it('has no rows for a file with none', async () => {
		const bytes = encode('a,b,c\n');
		const source = createCsvRowSource({
			columnCount: 3,
			rowCount: 0,
			index: { interval: 10, offsets: [] },
			size: bytes.length,
			read: async (s, e) => bytes.slice(s, e)
		});

		expect(await source.loadRows(0, 10)).toEqual([]);
	});
});

describe('fileReader', () => {
	it('reads the bytes between two offsets of a file', async () => {
		const read = fileReader(new Blob(['hello world']));

		expect(new TextDecoder().decode(await read(6, 11))).toBe('world');
	});
});

describe('urlReader', () => {
	const bytes = encode('0123456789');

	function stubFetch(...responses: Response[]) {
		const fetch = vi.fn();
		for (const response of responses) fetch.mockResolvedValueOnce(response);
		vi.stubGlobal('fetch', fetch);
		return fetch;
	}

	it('asks for the bytes with a Range header that includes the last byte', async () => {
		const fetch = stubFetch(new Response(bytes.slice(2, 6), { status: 206 }));
		const read = urlReader(async () => 'https://signed.example/get');

		expect(new TextDecoder().decode(await read(2, 6))).toBe('2345');
		expect(fetch).toHaveBeenCalledWith('https://signed.example/get', {
			headers: { Range: 'bytes=2-5' }
		});
	});

	it('cuts the bytes to size when the server ignores Range and sends the whole file', async () => {
		stubFetch(new Response(bytes, { status: 200 }));
		const read = urlReader(async () => 'https://signed.example/get');

		expect(new TextDecoder().decode(await read(2, 6))).toBe('2345');
	});

	it('asks for a fresh link and tries again when the first is forbidden', async () => {
		const fetch = stubFetch(
			new Response('expired', { status: 403 }),
			new Response(bytes.slice(0, 3), { status: 206 })
		);
		const getUrl = vi.fn(async (refresh: boolean) => (refresh ? 'https://new' : 'https://old'));
		const read = urlReader(getUrl);

		expect(new TextDecoder().decode(await read(0, 3))).toBe('012');
		expect(getUrl.mock.calls.map((c) => c[0])).toEqual([false, true]);
		expect(fetch.mock.calls.map((c) => c[0])).toEqual(['https://old', 'https://new']);
	});

	it('gives up when the fresh link is forbidden too', async () => {
		stubFetch(new Response('', { status: 403 }), new Response('', { status: 403 }));
		const read = urlReader(async () => 'https://signed.example/get');

		await expect(read(0, 3)).rejects.toThrow('The rows could not be read.');
	});

	it('fails on any other error without trying again', async () => {
		const fetch = stubFetch(new Response('', { status: 500 }));
		const read = urlReader(async () => 'https://signed.example/get');

		await expect(read(0, 3)).rejects.toThrow('The rows could not be read.');
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});
