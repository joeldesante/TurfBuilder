/** A canvassing script as a bucket's script list shows it, without its text. */
export interface ScriptSummary {
	id: string;
	bucket_id: string;
	name: string;
	updated_at: string;
}

/** A canvassing script with its text. */
export interface Script extends ScriptSummary {
	contents: string;
}
