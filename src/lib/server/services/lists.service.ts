import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import { requireBucketOrg, requireListAccess, requireListOrg } from '$lib/server/list-access';
import { clampPage, pageOffset, PAGE_SIZE } from '$lib/shared/utils/pagination';
import type { Page } from '$lib/shared/utils/pagination';
import { canOrg } from '$lib/server/permissions';
import type { FilterEntity, FilterGroup } from '$lib/shared/types/filters';
import { findBucketById } from './buckets.service';
import { buildFilterQuery } from './filters.service';

export interface List {
	id: string;
	name: string;
	bucket: string;
	entity_type: 'people' | 'locations';
	expires_at: string;
	created_at: string;
}

/** The lists in a bucket, newest first. 404 when it is in none of the caller's orgs, 403 without staff access. */
export async function listBucketLists(userId: string, bucketId: string): Promise<List[]> {
	const orgId = await requireBucketOrg(userId, bucketId);

	return withOrgTransaction(orgId, async (client) => {
		if (!(await canOrg(client, userId, orgId, 'system.access'))) throw error(403, 'Forbidden');

		const result = await client.query<List>(
			`SELECT id, name, bucket, entity_type, expires_at, created_at
			 FROM universe.list
			 WHERE bucket = $1 AND org_id = $2
			 ORDER BY created_at DESC`,
			[bucketId, orgId]
		);
		return result.rows;
	});
}

export interface PersonEntry {
	record_id: string;
	record_source: string;
	entity_id: string;
	first_name: string | null;
	last_name: string | null;
	email: string | null;
	phone: string | null;
}

export interface LocationEntry {
	record_id: string;
	record_source: string;
	entity_id: string;
	name: string | null;
	address_line_1: string | null;
	city: string | null;
	state_or_region: string | null;
	postal_code: string | null;
}

export type ListEntry = PersonEntry | LocationEntry;

/**
 * One page of a list's entries. Entries join back to the snapshotted version
 * rows (not the views), so they show the data as it was when the list was
 * created. For callers that already hold an org transaction and have checked
 * the list belongs to `orgId`.
 */
export async function queryListEntriesPage(
	client: PoolClient,
	orgId: string,
	list: { id: string; entity_type: string },
	requested: number
): Promise<Page<ListEntry>> {
	// The join to universe.list scopes every entry to the org: list_entry has no org column.
	const countResult = await client.query<{ count: string }>(
		`SELECT COUNT(*)::text AS count
		   FROM universe.list_entry le
		   JOIN universe.list l ON l.id = le.list_id AND l.org_id = $2
		  WHERE le.list_id = $1`,
		[list.id, orgId]
	);
	const totalCount = parseInt(countResult.rows[0].count, 10);
	const page = clampPage(requested, totalCount);
	const params = [list.id, orgId, PAGE_SIZE, pageOffset(page)];

	// Each order ends in le.id so it is total and pages cannot repeat or skip an entry.
	const result =
		list.entity_type === 'people'
			? await client.query<PersonEntry>(
					`SELECT
						le.record_id,
						le.record_source,
						op.entity_id::text AS entity_id,
						op.first_name,
						op.last_name,
						op.email,
						op.phone
					FROM universe.list_entry le
					JOIN universe.list l ON l.id = le.list_id AND l.org_id = $2
					LEFT JOIN universe.org_person op
						ON le.record_source = 'org_person' AND op.id = le.record_id
					WHERE le.list_id = $1
					ORDER BY op.last_name, op.first_name, le.id
					LIMIT $3 OFFSET $4`,
					params
				)
			: await client.query<LocationEntry>(
					`SELECT
						le.record_id,
						le.record_source,
						ol.entity_id::text AS entity_id,
						ol.name,
						ol.address_line_1,
						ol.city,
						ol.state_or_region,
						ol.postal_code
					FROM universe.list_entry le
					JOIN universe.list l ON l.id = le.list_id AND l.org_id = $2
					LEFT JOIN universe.org_location ol
						ON le.record_source = 'org_location' AND ol.id = le.record_id
					WHERE le.list_id = $1
					ORDER BY ol.city, ol.name, le.id
					LIMIT $3 OFFSET $4`,
					params
				);

	return { items: result.rows, totalCount, page, pageSize: PAGE_SIZE };
}

/** One page of a list's entries. 404 when it is in none of the caller's orgs, 403 without staff access. */
export async function listListEntries(
	userId: string,
	listId: string,
	requested: number
): Promise<Page<ListEntry>> {
	const orgId = await requireListOrg(userId, listId);

	return withOrgTransaction(orgId, async (client) => {
		await requireListAccess(client, userId, orgId, listId);

		const list = await client.query<{ entity_type: string }>(
			`SELECT entity_type FROM universe.list WHERE id = $1 AND org_id = $2`,
			[listId, orgId]
		);
		return queryListEntriesPage(
			client,
			orgId,
			{ id: listId, entity_type: list.rows[0].entity_type },
			requested
		);
	});
}

export interface CreateListInput {
	name: string;
	entity_type: FilterEntity;
	expires_at: string;
	/** What the list narrows its bucket down to, as the filter editor writes it. None takes the whole bucket. */
	filters?: FilterGroup;
}

/**
 * Creates a list from the records a bucket's filters match, narrowed by the
 * list's own filter, and snapshots them: from then on the list does not change
 * when the bucket's filters or the records themselves do. The list also keeps
 * the combined filter document, as a record of how it was made.
 *
 * 404 when the bucket is not in the organization, 400 when it does not include
 * that kind of record or a filter cannot run, 422 when the bucket's old filter
 * cannot be converted. Must run inside withOrgTransaction.
 */
export async function createList(
	client: PoolClient,
	orgId: string,
	bucketId: string,
	input: CreateListInput
): Promise<{ id: string }> {
	const bucket = await findBucketById(client, orgId, bucketId);
	if (!bucket) throw error(404, 'Bucket not found');

	const bucketGroup = bucket.filters[input.entity_type];
	if (!bucketGroup) throw error(400, `This bucket does not include ${input.entity_type}`);

	// The records are the bucket's, narrowed by the list's own filter.
	const own = input.filters;
	const effective: FilterGroup =
		own && own.filters.length > 0 ? { operator: 'AND', filters: [bucketGroup, own] } : bucketGroup;

	// Compiled before anything is written, so a filter that cannot run fails the request cleanly.
	const matches = buildFilterQuery(input.entity_type, effective, { orgId });

	const created = await client.query<{ id: string }>(
		`INSERT INTO universe.list (name, bucket, org_id, entity_type, expires_at, filters)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id`,
		[input.name, bucket.id, orgId, input.entity_type, input.expires_at, JSON.stringify(effective)]
	);
	const listId = created.rows[0].id;

	await client.query(
		`INSERT INTO universe.list_entry (id, list_id, record_id, record_source)
		 SELECT gen_random_uuid(), $${matches.params.length + 1}::uuid, matched.id, matched.source
		 FROM (${matches.sql}) matched`,
		[...matches.params, listId]
	);

	return { id: listId };
}

/** Creates a list in a bucket. 404 when the bucket is in none of the caller's orgs, 403 without staff access. */
export async function createBucketList(
	userId: string,
	bucketId: string,
	input: CreateListInput
): Promise<{ id: string }> {
	const orgId = await requireBucketOrg(userId, bucketId);

	return withOrgTransaction(orgId, async (client) => {
		if (!(await canOrg(client, userId, orgId, 'system.access'))) throw error(403, 'Forbidden');
		return createList(client, orgId, bucketId, input);
	});
}
