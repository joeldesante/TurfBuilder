import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { withOrgTransaction } from '$lib/server/database';
import {
	requireContactImportJobOrg,
	requireContactImportOrg,
	requireOrgPermission
} from '$lib/server/list-access';
import { logger } from '$lib/server/logger';
import {
	FunctionsNotConfiguredError,
	invokeFunction
} from '$lib/server/services/functions.service';
import type { ContactSchemaField } from '$lib/shared/types/contact-schemas';
import type { ContactImportJob, ContactImportJobStatus } from '$lib/shared/types/contact-imports';
import { mapTargets, mappingFormSchema } from '$lib/shared/utils/csv-mapping';

/** Staff access, the same permission the upload page asks for. */
const PERMISSION = 'system.access';

/** Jobs listed on the active imports page, active ones first, then newest. */
const LIST_LIMIT = 100;

/** A column position is a small number; the cap only keeps a hostile body from being huge. */
const MAX_COLUMNS = 10_000;

export const StartContactImportJobSchema = z.object({
	schemaId: z.uuid('Choose a schema'),
	mapping: z.record(z.string().min(1), z.number().int().min(0).max(MAX_COLUMNS))
});

export type StartContactImportJob = z.infer<typeof StartContactImportJobSchema>;

interface JobRow {
	id: string;
	file_id: string;
	file_name: string;
	status: ContactImportJobStatus;
	rows_total: number | null;
	rows_processed: number;
	rows_skipped: number;
	error: string | null;
	created_at: Date;
	started_at: Date | null;
	updated_at: Date;
	finished_at: Date | null;
}

/** Counts are cast so they come back as numbers, not strings. */
const COLUMNS = `j.id, j.file_id, f.file_name, j.status,
	j.rows_total::float8 AS rows_total, j.rows_processed::float8 AS rows_processed,
	j.rows_skipped::float8 AS rows_skipped, j.error,
	j.created_at, j.started_at, j.updated_at, j.finished_at`;

const FROM = `universe.contact_import_job j JOIN universe.contact_import_file f ON f.id = j.file_id`;

const iso = (date: Date | null) => (date ? date.toISOString() : null);

function toJob(row: JobRow): ContactImportJob {
	return {
		id: row.id,
		file_id: row.file_id,
		file_name: row.file_name,
		status: row.status,
		rows_total: row.rows_total,
		rows_processed: row.rows_processed,
		rows_skipped: row.rows_skipped,
		error: row.error,
		created_at: row.created_at.toISOString(),
		started_at: iso(row.started_at),
		updated_at: row.updated_at.toISOString(),
		finished_at: iso(row.finished_at)
	};
}

/**
 * Starts importing an uploaded file. The job is written to the database first, as
 * 'queued', and only then is the import function called, so there is always a row
 * to watch even if the call fails. When it fails the job is marked failed and the
 * caller gets a 503. 404 when the file is not in one of the caller's organizations
 * or has not finished uploading, 403 without staff access, 400 when the schema or
 * the mapping does not fit, 409 when the file is already being imported.
 */
export async function startContactImportJob(
	userId: string,
	importId: string,
	input: StartContactImportJob
): Promise<ContactImportJob> {
	const orgId = await requireContactImportOrg(userId, importId);
	await requireOrgPermission(userId, orgId, PERMISSION);

	const job = await withOrgTransaction(orgId, async (client) => {
		const file = await client.query<{ row_count: number | null }>(
			`SELECT row_count::float8 AS row_count FROM universe.contact_import_file
			 WHERE id = $1 AND org_id = $2 AND status = 'ready' AND deleted_at IS NULL`,
			[importId, orgId]
		);
		if (file.rows.length === 0) throw error(404, 'Import not found');

		const fields = await client.query<ContactSchemaField>(
			`SELECT f.id, f.name, f.type, f.required
			 FROM universe.contact_schema s
			 LEFT JOIN universe.contact_schema_field f ON f.schema_id = s.id AND f.org_id = s.org_id
			 WHERE s.id = $1 AND s.org_id = $2
			 ORDER BY f.position`,
			[input.schemaId, orgId]
		);
		if (fields.rows.length === 0) throw error(400, 'That schema was not found');
		const schemaFields = fields.rows.filter((f) => f.id !== null);

		// The page checks the mapping against the file's columns. Here it must still name
		// real fields and fill every required one, so a stale or forged request is refused.
		const known = new Set(mapTargets(schemaFields).map((t) => t.id));
		if (Object.keys(input.mapping).some((id) => !known.has(id))) {
			throw error(400, 'The mapping names a field that is not in the schema');
		}
		const checked = mappingFormSchema(schemaFields, MAX_COLUMNS).safeParse({
			mapping: input.mapping
		});
		if (!checked.success) throw error(400, checked.error.issues[0].message);

		const running = await client.query(
			`SELECT 1 FROM universe.contact_import_job
			 WHERE file_id = $1 AND org_id = $2 AND status IN ('queued', 'running')`,
			[importId, orgId]
		);
		if (running.rows.length > 0) throw error(409, 'This file is already being imported');

		const created = await client.query<{ id: string }>(
			`INSERT INTO universe.contact_import_job
			   (org_id, file_id, schema_id, mapping, rows_total, created_by)
			 VALUES ($1, $2, $3, $4::jsonb, $5, $6)
			 RETURNING id`,
			[
				orgId,
				importId,
				input.schemaId,
				JSON.stringify(input.mapping),
				file.rows[0].row_count,
				userId
			]
		);
		const row = await client.query<JobRow>(
			`SELECT ${COLUMNS} FROM ${FROM} WHERE j.id = $1 AND j.org_id = $2`,
			[created.rows[0].id, orgId]
		);
		return toJob(row.rows[0]);
	});

	// The transaction above is committed, so the job exists before the function runs.
	try {
		await invokeFunction('import-contacts', { orgId, jobId: job.id });
	} catch (err) {
		logger.error(
			{ err, organizationId: orgId, jobId: job.id },
			'The contact import function could not be started; the job is marked failed'
		);
		const message =
			err instanceof FunctionsNotConfiguredError
				? 'Imports are not set up on this server yet.'
				: 'The import could not be started. Try again shortly.';
		await withOrgTransaction(orgId, (client) =>
			client.query(
				`UPDATE universe.contact_import_job
				 SET status = 'failed', error = $3, finished_at = now(), updated_at = now()
				 WHERE id = $1 AND org_id = $2 AND status = 'queued'`,
				[job.id, orgId, message]
			)
		).catch((markErr) =>
			logger.error({ err: markErr, jobId: job.id }, 'The failed import job could not be marked')
		);
		throw error(503, message);
	}

	return job;
}

/**
 * The organization's import jobs: running and waiting ones first, then the newest.
 * 404 when the caller is not a member, 403 without staff access.
 */
export async function listContactImportJobs(
	userId: string,
	orgId: string
): Promise<ContactImportJob[]> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<JobRow>(
			`SELECT ${COLUMNS} FROM ${FROM}
			 WHERE j.org_id = $1
			 ORDER BY (j.status IN ('queued', 'running')) DESC, j.created_at DESC
			 LIMIT $2`,
			[orgId, LIST_LIMIT]
		);
		return result.rows.map(toJob);
	});
}

/**
 * One import job, for reading its progress on its own. 404 when it is not in one
 * of the caller's organizations, 403 without staff access.
 */
export async function getContactImportJob(
	userId: string,
	jobId: string
): Promise<ContactImportJob> {
	const orgId = await requireContactImportJobOrg(userId, jobId);
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<JobRow>(
			`SELECT ${COLUMNS} FROM ${FROM} WHERE j.id = $1 AND j.org_id = $2`,
			[jobId, orgId]
		);
		if (result.rows.length === 0) throw error(404, 'Import job not found');
		return toJob(result.rows[0]);
	});
}
