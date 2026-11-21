import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { withOrgTransaction } from '$lib/server/database';
import { requireContactImportOrg, requireOrgPermission } from '$lib/server/list-access';
import { logger } from '$lib/server/logger';
import {
	isStorageConfigured,
	presignContactImportDownload,
	presignContactImportUpload,
	StorageNotConfiguredError
} from '$lib/server/storage';
import type { ContactImportFile, ContactImportRowIndex } from '$lib/shared/types/contact-imports';
import { ROW_INDEX_INTERVAL } from '$lib/shared/utils/csv-index';

/** Staff access, the same permission the contact schema pages ask for. */
const PERMISSION = 'system.access';

/** 50 MB. A CSV of a few hundred thousand contacts is well under this. */
export const MAX_IMPORT_BYTES = 50_000_000;

/** Days an uploaded file stays before it is due to be purged, unless it is preserved. */
export const IMPORT_RETENTION_DAYS = 30;

/** Files listed on the upload page, newest first. */
const LIST_LIMIT = 100;

export const ContactImportUploadSchema = z.object({
	fileName: z.string().trim().min(1, 'The file needs a name').max(255, 'The file name is too long'),
	contentLength: z.number().int().positive().max(MAX_IMPORT_BYTES)
});

export type ContactImportUpload = z.infer<typeof ContactImportUploadSchema>;

/** The most rows a file can have, which caps the index at one entry per `ROW_INDEX_INTERVAL` of them. */
const MAX_ROWS = 100_000_000;

export const CompleteContactImportSchema = z
	.object({
		rowCount: z.number().int().min(0).max(MAX_ROWS),
		rowIndex: z.object({
			interval: z.literal(ROW_INDEX_INTERVAL),
			offsets: z.array(z.number().int().min(0)).max(Math.ceil(MAX_ROWS / ROW_INDEX_INTERVAL))
		})
	})
	.superRefine(({ rowCount, rowIndex }, ctx) => {
		if (rowIndex.offsets.length !== Math.ceil(rowCount / rowIndex.interval)) {
			ctx.addIssue({
				code: 'custom',
				path: ['rowIndex', 'offsets'],
				message: 'The row index does not match the row count'
			});
		} else if (rowIndex.offsets.some((offset, i) => i > 0 && offset <= rowIndex.offsets[i - 1])) {
			ctx.addIssue({
				code: 'custom',
				path: ['rowIndex', 'offsets'],
				message: 'The row index must go forward through the file'
			});
		}
	});

export type CompleteContactImport = z.infer<typeof CompleteContactImportSchema>;

interface ImportRow {
	id: string;
	file_name: string;
	size_bytes: number;
	row_count: number | null;
	created_at: Date;
	expires_at: Date;
	preserved: boolean;
}

/** The columns of a listed file. Sizes and counts are cast so they come back as numbers, not strings. */
const COLUMNS = `id, file_name, size_bytes::float8 AS size_bytes, row_count::float8 AS row_count,
	created_at, expires_at, preserved`;

function toFile(row: ImportRow): ContactImportFile {
	return {
		id: row.id,
		file_name: row.file_name,
		size_bytes: row.size_bytes,
		row_count: row.row_count,
		uploaded_at: row.created_at.toISOString(),
		expires_at: row.expires_at.toISOString(),
		preserved: row.preserved
	};
}

/** Storage that is not set up answers 503 with the message written for users. */
async function withStorage<T>(orgId: string, run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof StorageNotConfiguredError) {
			logger.warn(
				{ organizationId: orgId },
				'Contact import file requested but storage is not configured'
			);
			throw error(503, e.message);
		}
		throw e;
	}
}

/**
 * Starts an upload: records the file and answers a presigned PUT the browser
 * sends the CSV to, so the file never passes through this server. The file is
 * not listed until `completeContactImport` is called. 404 when the caller is
 * not a member, 403 without staff access, 503 when storage is not set up.
 */
export async function createContactImportUpload(
	userId: string,
	orgId: string,
	input: ContactImportUpload
): Promise<{ id: string; url: string; key: string }> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	const id = crypto.randomUUID();
	const signed = await withStorage(orgId, () =>
		presignContactImportUpload(orgId, id, input.contentLength)
	);

	await withOrgTransaction(orgId, (client) =>
		client.query(
			`INSERT INTO universe.contact_import_file
			   (id, org_id, storage_key, file_name, size_bytes, uploaded_by, expires_at)
			 VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(days => $7))`,
			[id, orgId, signed.key, input.fileName, input.contentLength, userId, IMPORT_RETENTION_DAYS]
		)
	);

	return { id, ...signed };
}

/**
 * Marks an upload finished and records how many data rows the browser counted,
 * which makes it appear in the list. Safe to repeat. 404 when the import is not
 * in one of the caller's organizations, 403 without staff access.
 */
export async function completeContactImport(
	userId: string,
	importId: string,
	input: CompleteContactImport
): Promise<ContactImportFile> {
	const orgId = await requireContactImportOrg(userId, importId);
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, async (client) => {
		const stored = await client.query<{ size_bytes: number }>(
			`SELECT size_bytes::float8 AS size_bytes FROM universe.contact_import_file
			 WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
			[importId, orgId]
		);
		if (stored.rows.length === 0) throw error(404, 'Import not found');

		// Every row starts inside the file, so the last offset is short of its size.
		const offsets = input.rowIndex.offsets;
		if (offsets.length > 0 && offsets[offsets.length - 1] >= stored.rows[0].size_bytes) {
			throw error(400, 'The row index does not fit the file');
		}

		const result = await client.query<ImportRow>(
			`UPDATE universe.contact_import_file
			 SET status = 'ready', row_count = $3, row_index_interval = $4, row_offsets = $5::bigint[]
			 WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
			 RETURNING ${COLUMNS}`,
			[importId, orgId, input.rowCount, input.rowIndex.interval, offsets]
		);
		if (result.rows.length === 0) throw error(404, 'Import not found');
		return toFile(result.rows[0]);
	});
}

/**
 * Archives an uploaded file: it drops out of the list and can no longer be loaded.
 * Only the record is marked, with a deleted time; the file stays in storage, so
 * nothing is lost. 404 when the import is not in one of the caller's
 * organizations or is already archived, 403 without staff access.
 */
export async function archiveContactImport(userId: string, importId: string): Promise<void> {
	const orgId = await requireContactImportOrg(userId, importId);
	await requireOrgPermission(userId, orgId, PERMISSION);

	await withOrgTransaction(orgId, async (client) => {
		const result = await client.query(
			`UPDATE universe.contact_import_file SET deleted_at = now()
			 WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
			[importId, orgId]
		);
		if (result.rowCount === 0) throw error(404, 'Import not found');
	});
}

/**
 * The organization's uploaded files that finished uploading, newest first. 404
 * when the caller is not a member, 403 without staff access.
 */
export async function listContactImports(
	userId: string,
	orgId: string
): Promise<ContactImportFile[]> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<ImportRow>(
			`SELECT ${COLUMNS}
			 FROM universe.contact_import_file
			 WHERE org_id = $1 AND status = 'ready' AND deleted_at IS NULL
			 ORDER BY created_at DESC
			 LIMIT $2`,
			[orgId, LIST_LIMIT]
		);
		return result.rows.map(toFile);
	});
}

/**
 * A short-lived link the browser reads an uploaded file from, so the file never
 * passes through this server, and the row index for reading a slice of it with a
 * byte-range request (null when the browser never reported one). 404 when the
 * import is not in one of the caller's organizations or has not finished
 * uploading, 403 without staff access, 503 when storage is not set up.
 */
export async function getContactImportDownload(
	userId: string,
	importId: string
): Promise<{ url: string; rowIndex: ContactImportRowIndex | null }> {
	const orgId = await requireContactImportOrg(userId, importId);
	await requireOrgPermission(userId, orgId, PERMISSION);

	const stored = await withOrgTransaction(orgId, async (client) => {
		const result = await client.query<{
			storage_key: string;
			row_index_interval: number | null;
			row_offsets: number[] | null;
		}>(
			`SELECT storage_key, row_index_interval, row_offsets::float8[] AS row_offsets
			 FROM universe.contact_import_file
			 WHERE id = $1 AND org_id = $2 AND status = 'ready' AND deleted_at IS NULL`,
			[importId, orgId]
		);
		return result.rows[0];
	});
	if (!stored) throw error(404, 'Import not found');

	const url = await withStorage(orgId, () => presignContactImportDownload(stored.storage_key));
	const rowIndex =
		stored.row_index_interval !== null && stored.row_offsets !== null
			? { interval: stored.row_index_interval, offsets: stored.row_offsets }
			: null;
	return { url, rowIndex };
}

/**
 * Whether contact imports can run: the bucket settings and credentials are
 * all set. 404 when the caller is not a member, 403 without staff access.
 */
export async function isContactImportAvailable(userId: string, orgId: string): Promise<boolean> {
	await requireOrgPermission(userId, orgId, PERMISSION);
	return isStorageConfigured();
}
