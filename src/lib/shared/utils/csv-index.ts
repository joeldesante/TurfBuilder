/** How many data rows apart the entries of a CSV row index are. */
export const ROW_INDEX_INTERVAL = 1000;

/**
 * Where rows start in a CSV, so a slice of the file can be read without reading
 * the rest. `offsets[k]` is the byte offset where data row `k * interval` begins,
 * counting from 0 at the first row under the header. A reader wanting row `n`
 * starts at `offsets[floor(n / interval)]` and reads on until it has the rows.
 */
export interface CsvIndex {
	/** Data rows, not counting the header. Lines with nothing on them are not rows. */
	rowCount: number;
	interval: number;
	offsets: number[];
}

const LF = 0x0a;
const CR = 0x0d;
const QUOTE = 0x22;

/**
 * Reads a CSV as bytes, in any size of pieces, and records where its rows start.
 *
 * It works on bytes, not text, so the offsets are right for accented letters and
 * emoji, which take more than one byte. A line ends at a line feed, a carriage
 * return, or both; a line break inside a quoted cell does not end the row, and
 * a quote mark inside a quoted cell is written twice, which toggles twice and so
 * changes nothing. An empty line is not a row, as when the file is parsed with
 * empty lines skipped.
 */
export async function indexCsvChunks(
	chunks: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
	interval = ROW_INDEX_INTERVAL
): Promise<CsvIndex> {
	if (!Number.isInteger(interval) || interval < 1)
		throw new RangeError('interval must be 1 or more');

	const offsets: number[] = [];
	/** Byte offset of the byte about to be read. */
	let position = 0;
	let inQuotes = false;
	/** Byte offset where the current line began. */
	let lineStart = 0;
	/** Whether the current line has anything on it yet. */
	let lineStarted = false;
	/** The last byte was a carriage return that ended a line, so a line feed next belongs to it. */
	let afterCarriageReturn = false;
	/** Non-empty lines begun so far, the header included. */
	let lines = 0;

	for await (const chunk of chunks) {
		for (let i = 0; i < chunk.length; i++, position++) {
			const byte = chunk[i];

			if (afterCarriageReturn) {
				afterCarriageReturn = false;
				if (byte === LF) {
					lineStart = position + 1;
					continue;
				}
			}

			if (!inQuotes && (byte === LF || byte === CR)) {
				lineStart = position + 1;
				lineStarted = false;
				afterCarriageReturn = byte === CR;
				continue;
			}

			if (!lineStarted) {
				lineStarted = true;
				const dataRow = lines - 1;
				if (dataRow >= 0 && dataRow % interval === 0) offsets.push(lineStart);
				lines++;
			}

			if (byte === QUOTE) inQuotes = !inQuotes;
		}
	}

	return { rowCount: Math.max(0, lines - 1), interval, offsets };
}
