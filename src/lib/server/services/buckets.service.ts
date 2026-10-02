import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import { requireBucketOrg, requireOrgPermission } from '$lib/server/list-access';
import { canOrg } from '$lib/server/permissions';

export interface BucketInput {
	name: string;
	slug: string;
	filter: Record<string, unknown>;
}

export interface Bucket extends BucketInput {
	id: string;
	org_id: string;
	created_at: string;
}

// There are no bucket.* permission keys yet, so buckets use the same staff
// check as list documents.
const PERMISSION = 'system.access';

const COLUMNS = 'id, org_id, name, slug, filter, created_at';

const UNIQUE_VIOLATION = '23505';

function isSlugTaken(e: unknown): boolean {
	return (e as { code?: string })?.code === UNIQUE_VIOLATION;
}

async function requireStaff(client: PoolClient, userId: string, orgId: string) {
	if (!(await canOrg(client, userId, orgId, PERMISSION))) throw error(403, 'Forbidden');
}

/** The organization's buckets, newest first. 404 unless the caller is a member, 403 without staff access. */
export async function listBuckets(userId: string, orgId: string): Promise<Bucket[]> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<Bucket>(
			`SELECT ${COLUMNS} FROM universe.bucket WHERE org_id = $1 ORDER BY created_at DESC`,
			[orgId]
		);
		return result.rows;
	});
}

/** Creates a bucket in the organization. 409 when the slug is taken there. */
export async function createBucket(
	userId: string,
	orgId: string,
	input: BucketInput
): Promise<Bucket> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	try {
		return await withOrgTransaction(orgId, async (client) => {
			const result = await client.query<Bucket>(
				`INSERT INTO universe.bucket (name, slug, org_id, filter)
				 VALUES ($1, $2, $3, $4)
				 RETURNING ${COLUMNS}`,
				[input.name, input.slug, orgId, JSON.stringify(input.filter)]
			);
			return result.rows[0];
		});
	} catch (e) {
		if (isSlugTaken(e)) throw error(409, 'A bucket with that slug already exists');
		throw e;
	}
}

/** One bucket. 404 when it is in none of the caller's orgs. */
export async function getBucket(userId: string, bucketId: string): Promise<Bucket> {
	const orgId = await requireBucketOrg(userId, bucketId);

	return withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		const result = await client.query<Bucket>(
			`SELECT ${COLUMNS} FROM universe.bucket WHERE id = $1 AND org_id = $2`,
			[bucketId, orgId]
		);
		if (result.rowCount === 0) throw error(404, 'Bucket not found');
		return result.rows[0];
	});
}

/** Replaces a bucket's name, slug, and filter. 409 when the slug is taken in its org. */
export async function replaceBucket(
	userId: string,
	bucketId: string,
	input: BucketInput
): Promise<Bucket> {
	return updateBucket(userId, bucketId, input);
}

/**
 * Updates the given fields of a bucket and leaves the rest as they are. 409
 * when the slug is taken in its org.
 */
export async function updateBucket(
	userId: string,
	bucketId: string,
	input: Partial<BucketInput>
): Promise<Bucket> {
	const orgId = await requireBucketOrg(userId, bucketId);

	try {
		return await withOrgTransaction(orgId, async (client) => {
			await requireStaff(client, userId, orgId);

			// COALESCE keeps the stored value for any field the caller left out.
			const result = await client.query<Bucket>(
				`UPDATE universe.bucket
				 SET name = COALESCE($3, name),
				     slug = COALESCE($4, slug),
				     filter = COALESCE($5::jsonb, filter)
				 WHERE id = $1 AND org_id = $2
				 RETURNING ${COLUMNS}`,
				[
					bucketId,
					orgId,
					input.name ?? null,
					input.slug ?? null,
					input.filter === undefined ? null : JSON.stringify(input.filter)
				]
			);
			if (result.rowCount === 0) throw error(404, 'Bucket not found');
			return result.rows[0];
		});
	} catch (e) {
		if (isSlugTaken(e)) throw error(409, 'A bucket with that slug already exists');
		throw e;
	}
}
