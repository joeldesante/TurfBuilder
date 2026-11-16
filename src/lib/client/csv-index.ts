import { indexCsvChunks, type CsvIndex } from '$lib/shared/utils/csv-index';

/** A file's bytes, piece by piece, without holding the whole file in memory. */
async function* readChunks(file: Blob): AsyncGenerator<Uint8Array> {
	const reader = file.stream().getReader();
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) return;
			yield value;
		}
	} finally {
		reader.releaseLock();
	}
}

/**
 * Counts a CSV file's rows and records where every thousandth starts, reading the
 * file once, in pieces. Rejects with a message safe to show a user.
 */
export async function indexCsvFile(file: Blob): Promise<CsvIndex> {
	try {
		return await indexCsvChunks(readChunks(file));
	} catch {
		throw new Error('The rows could not be counted in that file.');
	}
}
