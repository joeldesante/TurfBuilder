import Papa from 'papaparse';
import type { ContactImportRowIndex } from '$lib/shared/types/contact-imports';

/** Reads bytes `start` up to, not including, `end` of a file. */
export type ReadRange = (start: number, end: number) => Promise<Uint8Array>;

/** Rows of a CSV that can be asked for by position, without reading the whole file. */
export interface RowSource {
	/** Data rows, not counting the header. */
	rowCount: number;
	/** Up to `limit` rows from row `offset`, each exactly `columnCount` cells long. */
	loadRows: (offset: number, limit: number) => Promise<string[][]>;
}

/** Blocks of rows kept after they are read, so scrolling back or to a neighbouring page costs nothing. */
const CACHED_BLOCKS = 20;

/**
 * Reads rows of a CSV by position using its row index. Each entry of the index
 * opens a block of `interval` rows, and a block is read with one byte-range
 * request, so asking for a screenful of rows from the middle of a file of
 * hundreds of thousands of rows reads about a thousand rows, not the file.
 */
export function createCsvRowSource(options: {
	columnCount: number;
	rowCount: number;
	index: ContactImportRowIndex;
	/** The file's size in bytes, which ends the last block. */
	size: number;
	read: ReadRange;
}): RowSource {
	const { columnCount, rowCount, index, size, read } = options;
	const blocks = new Map<number, Promise<string[][]>>();

	async function readBlock(k: number): Promise<string[][]> {
		const start = index.offsets[k];
		const end = k + 1 < index.offsets.length ? index.offsets[k + 1] : size;
		if (end <= start) return [];

		const text = new TextDecoder().decode(await read(start, end));
		const { data } = Papa.parse<string[]>(text, { skipEmptyLines: true });
		// A row is as long as the header: short ones are filled out, long ones cut.
		return data.map((row) => Array.from({ length: columnCount }, (_, i) => row[i] ?? ''));
	}

	function block(k: number): Promise<string[][]> {
		let rows = blocks.get(k);
		if (!rows) {
			rows = readBlock(k);
			// A failed read is not kept, so the next ask tries again.
			rows.catch(() => blocks.delete(k));
			blocks.set(k, rows);
			if (blocks.size > CACHED_BLOCKS) blocks.delete(blocks.keys().next().value as number);
		}
		return rows;
	}

	return {
		rowCount,
		async loadRows(offset, limit) {
			const end = Math.min(offset + limit, rowCount);
			if (offset < 0 || offset >= end) return [];

			const first = Math.floor(offset / index.interval);
			const last = Math.floor((end - 1) / index.interval);
			const read = await Promise.all(
				Array.from({ length: last - first + 1 }, (_, i) => block(first + i))
			);
			const from = first * index.interval;
			return read.flat().slice(offset - from, end - from);
		}
	};
}

/** Reads ranges of a file the browser already holds, such as one just chosen. */
export function fileReader(file: Blob): ReadRange {
	return async (start, end) => new Uint8Array(await file.slice(start, end).arrayBuffer());
}

/**
 * Reads ranges of a file in storage through a presigned link with a `Range`
 * request. Presigned links expire, so when storage turns a request down as
 * forbidden it asks `getUrl` for a fresh link (`refresh` true) and tries once more.
 * A server that ignores `Range` answers with the whole file, which is cut to size.
 */
export function urlReader(getUrl: (refresh: boolean) => Promise<string>): ReadRange {
	return async (start, end) => {
		for (let attempt = 0; attempt < 2; attempt++) {
			const response = await fetch(await getUrl(attempt > 0), {
				headers: { Range: `bytes=${start}-${end - 1}` }
			});
			if (response.status === 403 && attempt === 0) continue;
			if (!response.ok) throw new Error('The rows could not be read.');

			const bytes = new Uint8Array(await response.arrayBuffer());
			return response.status === 206 ? bytes : bytes.slice(start, end);
		}
		throw new Error('The rows could not be read.');
	};
}
