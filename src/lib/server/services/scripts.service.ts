import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import { requireBucketOrg, requireScriptOrg } from '$lib/server/list-access';
import { canOrg } from '$lib/server/permissions';
import type { CreateScriptInput, UpdateScriptInput } from '$lib/shared/schemas/scripts';
import type { Script, ScriptSummary } from '$lib/shared/types/scripts';

// Scripts have no permission keys of their own; they use the same staff check
// as buckets and surveys.
const PERMISSION = 'system.access';

// The table names the bucket column `bucket`; callers see `bucket_id`.
const SUMMARY_COLUMNS = 'id, bucket AS bucket_id, name, updated_at';
const SCRIPT_COLUMNS = `${SUMMARY_COLUMNS}, contents`;

async function requireStaff(client: PoolClient, userId: string, orgId: string) {
	if (!(await canOrg(client, userId, orgId, PERMISSION))) throw error(403, 'Forbidden');
}

/** The scripts in a bucket, most recently changed first. 404 when it is in none of the caller's orgs, 403 without staff access. */
export async function listBucketScripts(
	userId: string,
	bucketId: string
): Promise<ScriptSummary[]> {
	const orgId = await requireBucketOrg(userId, bucketId);

	return withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		const result = await client.query<ScriptSummary>(
			`SELECT ${SUMMARY_COLUMNS}
			 FROM universe.script
			 WHERE bucket = $1 AND org_id = $2
			 ORDER BY updated_at DESC, id`,
			[bucketId, orgId]
		);
		return result.rows;
	});
}

/** Creates a script in a bucket, empty unless contents are given. 404 when the bucket is in none of the caller's orgs. */
export async function createScript(
	userId: string,
	bucketId: string,
	input: CreateScriptInput
): Promise<Script> {
	const orgId = await requireBucketOrg(userId, bucketId);

	return withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		const result = await client.query<Script>(
			`INSERT INTO universe.script (name, contents, bucket, org_id)
			 VALUES ($1, $2, $3, $4)
			 RETURNING ${SCRIPT_COLUMNS}`,
			[input.name, input.contents ?? '', bucketId, orgId]
		);
		return result.rows[0];
	});
}

/** One script with its text. 404 when it is in none of the caller's orgs. */
export async function getScript(userId: string, scriptId: string): Promise<Script> {
	const orgId = await requireScriptOrg(userId, scriptId);

	return withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		const result = await client.query<Script>(
			`SELECT ${SCRIPT_COLUMNS} FROM universe.script WHERE id = $1 AND org_id = $2`,
			[scriptId, orgId]
		);
		if (result.rowCount === 0) throw error(404, 'Script not found');
		return result.rows[0];
	});
}

/** Updates the given fields of a script and leaves the rest as they are. */
export async function updateScript(
	userId: string,
	scriptId: string,
	input: UpdateScriptInput
): Promise<Script> {
	const orgId = await requireScriptOrg(userId, scriptId);

	return withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		const result = await client.query<Script>(
			`UPDATE universe.script
			 SET name = COALESCE($3, name),
			     contents = COALESCE($4, contents),
			     updated_at = now()
			 WHERE id = $1 AND org_id = $2
			 RETURNING ${SCRIPT_COLUMNS}`,
			[scriptId, orgId, input.name ?? null, input.contents ?? null]
		);
		if (result.rowCount === 0) throw error(404, 'Script not found');
		return result.rows[0];
	});
}
