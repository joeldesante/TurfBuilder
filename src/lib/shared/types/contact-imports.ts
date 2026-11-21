/**
 * Where rows start in an uploaded CSV, so a slice can be read with a byte-range
 * request. `offsets[k]` is the byte offset where data row `k * interval` begins,
 * counting from 0 at the first row under the header.
 */
export interface ContactImportRowIndex {
	interval: number;
	offsets: number[];
}

/** A CSV uploaded for importing contacts, as the upload page lists it. */
export interface ContactImportFile {
	id: string;
	file_name: string;
	size_bytes: number;
	/** Data rows, not counting the header. Null when they have not been counted. */
	row_count: number | null;
	uploaded_at: string;
	/** When the file is due to be purged from storage. Ignored while `preserved`. */
	expires_at: string;
	/** Kept past `expires_at` until a person removes it. */
	preserved: boolean;
}

export type ContactImportJobStatus = 'queued' | 'running' | 'completed' | 'failed';

/** One run of the contact import over an uploaded file, as the active imports page lists it. */
export interface ContactImportJob {
	id: string;
	file_id: string;
	file_name: string;
	status: ContactImportJobStatus;
	/** Data rows in the file. Null when the file's rows were never counted. */
	rows_total: number | null;
	/** Rows already read, written or left out. Moves after every batch the import commits. */
	rows_processed: number;
	/** Of those, rows that made no contact: a missing or invalid coordinate, or a required field left blank. */
	rows_skipped: number;
	/** A message safe to show a person, set when the run failed. */
	error: string | null;
	created_at: string;
	started_at: string | null;
	/** Moves with every batch, so a running job that has stopped moving is visible. */
	updated_at: string;
	finished_at: string | null;
}
