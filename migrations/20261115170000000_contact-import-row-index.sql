-- Up Migration
-- Where rows start in an uploaded CSV, so a slice of it can be read from storage
-- with a byte-range request instead of reading the whole file. The browser
-- records it while it counts the rows: row_offsets[k] is the byte offset where
-- data row k * row_index_interval begins, counting from the first row under the
-- header. Null until the browser has reported it.

ALTER TABLE universe.contact_import_file
	ADD COLUMN row_index_interval integer CHECK (row_index_interval > 0),
	ADD COLUMN row_offsets bigint[],
	ADD CONSTRAINT contact_import_file_row_index_complete
		CHECK ((row_index_interval IS NULL) = (row_offsets IS NULL));

-- Down Migration

ALTER TABLE universe.contact_import_file
	DROP CONSTRAINT contact_import_file_row_index_complete,
	DROP COLUMN row_offsets,
	DROP COLUMN row_index_interval;
