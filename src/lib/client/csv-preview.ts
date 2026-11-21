import Papa from 'papaparse';

export interface CsvPreview {
	/** The first row, trimmed. A blank header becomes "Column N". */
	headers: string[];
	/** Up to `sampleRows` rows under the header, each as long as `headers`. */
	samples: string[][];
}

/**
 * Reads the column names and a few sample rows from a CSV in the browser,
 * without reading the rest of it. The CSV is a file the person chose, or the
 * address of one in storage, which is fetched only as far as the rows needed.
 * Rejects with a message safe to show a user.
 */
export function readCsvPreview(source: File | string, sampleRows = 3): Promise<CsvPreview> {
	return new Promise((resolve, reject) => {
		const onComplete = ({ data }: Papa.ParseResult<string[]>) => {
			const [first, ...rest] = data;
			if (!first || first.every((cell) => cell.trim() === '')) {
				reject(new Error('That file has no columns. Check that it is a CSV with a header row.'));
				return;
			}
			const headers = first.map((cell, i) => cell.trim() || `Column ${i + 1}`);
			const samples = rest.map((row) => headers.map((_, i) => (row[i] ?? '').trim()));
			resolve({ headers, samples });
		};
		const onError = () => reject(new Error('The columns could not be read from that file.'));
		const common = { preview: sampleRows + 1, skipEmptyLines: true };

		if (typeof source === 'string') {
			Papa.parse<string[]>(source, {
				...common,
				download: true,
				complete: onComplete,
				error: onError
			});
		} else {
			Papa.parse<string[]>(source, { ...common, complete: onComplete, error: onError });
		}
	});
}
