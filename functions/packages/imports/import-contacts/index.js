'use strict';

const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { parse } = require('csv-parse');
const { pipeline } = require('node:stream');
const { Pool } = require('pg');
const { importBatch } = require('./import-batch');

/** Rows written per transaction. Each batch is one commit and one progress update. */
const BATCH_SIZE = Number(process.env.IMPORT_BATCH_SIZE) || 500;

/**
 * Pacing: after each batch the function sleeps for (time the batch took x PACE_RATIO).
 * 1 means the database is busy about half the time, 2 about a third, 0 turns pacing off.
 */
const PACE_RATIO = Number(process.env.IMPORT_PACE_RATIO ?? 1);

/**
 * A running job that has not moved for this long is taken to be dead (the function was killed or
 * timed out), and a new call may take it over. A live job commits a batch every few seconds.
 */
const STALE_AFTER_SECONDS = 120;

/** The longest single pause, so a slow batch cannot stall the run. */
const MAX_PAUSE_MS = 5000;

// Created outside main so a warm function reuses the connection between calls.
let pool;
let s3;

function getPool() {
	pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
	return pool;
}

function getS3() {
	s3 ??= new S3Client({
		endpoint: process.env.SPACES_ENDPOINT,
		region: process.env.SPACES_REGION || 'us-east-1',
		// Spaces and the local mock address buckets by path, not by subdomain.
		forcePathStyle: true,
		credentials: {
			accessKeyId: process.env.SPACES_ACCESS_KEY_ID,
			secretAccessKey: process.env.SPACES_SECRET_ACCESS_KEY
		}
	});
	return s3;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(statusCode, message) {
	return { statusCode, body: { error: message } };
}

/** Runs one statement in its own transaction scoped to the org, the way withOrgTransaction does. */
async function inOrgTransaction(orgId, work) {
	const client = await getPool().connect();
	try {
		await client.query('BEGIN');
		await client.query("SELECT set_config('app.current_org_id', $1, true)", [orgId]);
		const result = await work(client);
		await client.query('COMMIT');
		return result;
	} catch (err) {
		await client.query('ROLLBACK').catch(() => {});
		throw err;
	} finally {
		client.release();
	}
}

/**
 * Writes a batch and moves rows_processed in the same transaction, so the count is always
 * exactly the rows that are committed. That also makes a restart safe: it skips that many rows.
 */
async function commitBatch(orgId, jobId, rows, job) {
	const started = Date.now();
	await inOrgTransaction(orgId, async (client) => {
		const skipped = await importBatch(client, orgId, rows, job);
		await client.query(
			`UPDATE universe.contact_import_job
			 SET rows_processed = rows_processed + $3, rows_skipped = rows_skipped + $4,
			     updated_at = now()
			 WHERE id = $1 AND org_id = $2`,
			[jobId, orgId, rows.length, skipped]
		);
	});
	const spent = Date.now() - started;
	if (PACE_RATIO > 0) await sleep(Math.min(spent * PACE_RATIO, MAX_PAUSE_MS));
}

async function markFailed(orgId, jobId, message) {
	await inOrgTransaction(orgId, (client) =>
		client.query(
			`UPDATE universe.contact_import_job
			 SET status = 'failed', error = $3, finished_at = now(), updated_at = now()
			 WHERE id = $1 AND org_id = $2`,
			[jobId, orgId, message]
		)
	);
}

/**
 * Reads the file from the top, skips the rows already committed, and commits the rest in
 * batches. progress.done is the number of rows committed so far; it moves after every batch, so
 * a pass that fails halfway leaves it exact. Errors from the file stream end this pass as errors
 * (pipeline passes them on; a bare .pipe() would swallow them and leave the loop waiting).
 */
async function readPass(orgId, jobId, job, progress) {
	const object = await getS3().send(
		new GetObjectCommand({ Bucket: process.env.SPACES_BUCKET, Key: job.storage_key })
	);
	const parser = parse({ bom: true, from_line: 2, skip_empty_lines: true, trim: true });
	pipeline(object.Body, parser, () => {});

	const skip = progress.done;
	let seen = 0;
	let batch = [];
	const flush = async () => {
		try {
			await commitBatch(orgId, jobId, batch, job);
		} catch (err) {
			// A failed write is not a dropped download, and is not read again.
			err.fromWrite = true;
			throw err;
		}
		progress.done += batch.length;
		batch = [];
	};

	for await (const row of parser) {
		// Rows before `skip` were committed by an earlier run or an earlier pass.
		if (seen++ < skip) continue;
		batch.push(row);
		if (batch.length === BATCH_SIZE) await flush();
	}
	if (batch.length > 0) await flush();
}

/**
 * Entry point. Called with { orgId, jobId }. The app creates the job row ('queued') first,
 * so the browser has something to poll as soon as the upload is accepted.
 * Logs ids and counts only, never row values.
 */
async function main(args) {
	const { orgId, jobId } = args ?? {};
	if (typeof orgId !== 'string' || typeof jobId !== 'string') {
		return fail(400, 'orgId and jobId are required');
	}

	let rowsDone = 0;
	try {
		// Claim the job and read where it left off. A job that is already running,
		// or finished, is not started a second time.
		const job = await inOrgTransaction(orgId, async (client) => {
			const claimed = await client.query(
				`UPDATE universe.contact_import_job j
				 SET status = 'running', error = NULL, started_at = COALESCE(j.started_at, now()),
				     updated_at = now(),
				     rows_total = f.row_count
				 FROM universe.contact_import_file f
				 WHERE j.id = $1 AND j.org_id = $2
				   AND (j.status IN ('queued', 'failed')
				        OR (j.status = 'running' AND j.updated_at < now() - make_interval(secs => $3)))
				   AND f.id = j.file_id AND f.status = 'ready' AND f.deleted_at IS NULL
				 RETURNING j.rows_processed::float8 AS rows_processed, j.schema_id AS "schemaId",
				           j.mapping, j.created_by AS "createdBy", f.storage_key`,
				[jobId, orgId, STALE_AFTER_SECONDS]
			);
			return claimed.rows[0];
		});
		if (!job) return fail(409, 'The import job cannot be started');

		job.id = jobId;
		const progress = { done: job.rows_processed };
		rowsDone = progress.done;

		// The file is read one pass at a time. A pass that is cut off (storage drops a download that
		// is held open while the rows are written) is started again from the top, skipping the rows
		// already committed, for as long as each pass gets somewhere.
		for (;;) {
			const before = progress.done;
			try {
				await readPass(orgId, jobId, job, progress);
				break;
			} catch (err) {
				const cutOff = !err.fromWrite && !String(err.code).startsWith('CSV_');
				if (!cutOff || progress.done === before) throw err;
				console.warn(
					JSON.stringify({ msg: 'contact import read was cut off, reading on', orgId, jobId, rowsDone: progress.done })
				);
			}
		}
		rowsDone = progress.done;

		await inOrgTransaction(orgId, (client) =>
			client.query(
				`UPDATE universe.contact_import_job
				 SET status = 'completed', finished_at = now(), updated_at = now()
				 WHERE id = $1 AND org_id = $2`,
				[jobId, orgId]
			)
		);
		console.log(JSON.stringify({ msg: 'contact import finished', orgId, jobId, rowsDone }));
		return { body: { rowsProcessed: rowsDone } };
	} catch (err) {
		console.error(
			JSON.stringify({ msg: 'contact import failed', orgId, jobId, rowsDone, error: err.name })
		);
		await markFailed(orgId, jobId, 'The import stopped before it finished.').catch(() => {});
		return fail(500, 'The import failed');
	}
}

exports.main = main;
