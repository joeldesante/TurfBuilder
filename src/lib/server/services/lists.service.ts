import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import {
	requireBucketOrg,
	requireListAccess,
	requireListOrg,
	requireOrgPermission
} from '$lib/server/list-access';
import { clampPage, pageOffset, PAGE_SIZE } from '$lib/shared/utils/pagination';
import type { Page } from '$lib/shared/utils/pagination';
import { canOrg } from '$lib/server/permissions';
import { recordEvent } from './activity.service';
import type { FilterEntity, FilterGroup } from '$lib/shared/types/filters';
import { findBucketById } from './buckets.service';
import { buildFilterQuery } from './filters.service';
import { line1Sql, nameSql } from './contact-columns';

export interface List {
	id: string;
	name: string;
	bucket: string;
	entity_type: 'people' | 'locations';
	expires_at: string;
	created_at: string;
	/** How many records the list holds. */
	entry_count: number;
}

/** The lists in a bucket with their sizes, newest first. 404 when it is in none of the caller's orgs, 403 without staff access. */
export async function listBucketLists(userId: string, bucketId: string): Promise<List[]> {
	const orgId = await requireBucketOrg(userId, bucketId);

	return withOrgTransaction(orgId, async (client) => {
		if (!(await canOrg(client, userId, orgId, 'system.access'))) throw error(403, 'Forbidden');

		const result = await client.query<List>(
			`SELECT l.id, l.name, l.bucket, l.entity_type, l.expires_at, l.created_at,
			        (SELECT COUNT(*)::int FROM universe.list_entry le WHERE le.list_id = l.id) AS entry_count
			 FROM universe.list l
			 WHERE l.bucket = $1 AND l.org_id = $2
			 ORDER BY l.created_at DESC`,
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
 * One page of a list's entries. Entries join back to the versions the list
 * recorded (for locations, the contact version and the address version), not
 * the views, so they show the data as it was when the list was created. For callers that already hold an org transaction and have checked
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
						c.entity_id::text AS entity_id,
						${nameSql('c')} AS name,
						${line1Sql('a')} AS address_line_1,
						a.locality AS city,
						a.region AS state_or_region,
						a.postcode AS postal_code
					FROM universe.list_entry le
					JOIN universe.list l ON l.id = le.list_id AND l.org_id = $2
					LEFT JOIN universe.org_contact c
						ON le.record_source = 'org_contact' AND c.id = le.record_id AND c.org_id = $2
					LEFT JOIN universe.org_address a ON a.id = le.address_id AND a.org_id = $2
					WHERE le.list_id = $1
					ORDER BY city, name, le.id
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
	// A location entry records the address version too, since its contact only names the address.
	const locations = input.entity_type === 'locations';
	const matches = buildFilterQuery(input.entity_type, effective, {
		orgId,
		columns: locations ? ['id', 'source', 'address_id'] : ['id', 'source']
	});

	const created = await client.query<{ id: string }>(
		`INSERT INTO universe.list (name, bucket, org_id, entity_type, expires_at, filters)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id`,
		[input.name, bucket.id, orgId, input.entity_type, input.expires_at, JSON.stringify(effective)]
	);
	const listId = created.rows[0].id;

	await client.query(
		`INSERT INTO universe.list_entry (id, list_id, record_id, record_source, address_id)
		 SELECT gen_random_uuid(), $${matches.params.length + 1}::uuid, matched.id, matched.source,
		        ${locations ? 'matched.address_id' : 'NULL::uuid'}
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

	const created = await withOrgTransaction(orgId, async (client) => {
		if (!(await canOrg(client, userId, orgId, 'system.access'))) throw error(403, 'Forbidden');
		return createList(client, orgId, bucketId, input);
	});

	await recordEvent('list.created', { userId, orgId, sourceKey: `list.created:${created.id}` });
	return created;
}

export interface BucketList {
	id: string;
	name: string;
	entity_type: 'people' | 'locations';
	expires_at: string;
	created_at: string;
	bucket_id: string;
}

/**
 * A list of the bucket with that slug, for pages outside the bucket layout.
 * 404 unless the caller is a member and the list is in that bucket, 403
 * without staff access.
 */
export async function getBucketList(
	userId: string,
	orgId: string,
	bucketSlug: string,
	listId: string
): Promise<BucketList> {
	await requireOrgPermission(userId, orgId, 'system.access');

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<BucketList>(
			`SELECT l.id, l.name, l.entity_type, l.expires_at, l.created_at, l.bucket AS bucket_id
			 FROM universe.list l
			 JOIN universe.bucket b ON b.id = l.bucket AND b.org_id = l.org_id
			 WHERE l.id = $1 AND l.org_id = $2 AND b.slug = $3`,
			[listId, orgId, bucketSlug]
		);
		if (result.rowCount === 0) throw error(404, 'List not found');
		return result.rows[0];
	});
}

export interface ListTurfSummary {
	id: string;
	code: string;
	expires_at: string;
	created_at: string;
	author: string;
	survey_name: string | null;
	/** Doors on the turf. */
	location_count: string;
	/** Doors visited at least once. */
	attempted_count: string;
}

export interface ListDetail {
	list: Omit<BucketList, 'bucket_id'>;
	entries: ListEntry[];
	entryCount: number;
	page: number;
	pageSize: number;
	turfs: ListTurfSummary[];
	/** Whether a generated PDF of the list is ready. */
	hasPdf: boolean;
}

/**
 * The list page: one page of a list's entries, its turfs with their progress,
 * and whether its PDF is ready. 404 when the bucket is in none of the caller's
 * orgs or the list is not in it, 403 without staff access.
 */
export async function getListDetail(
	userId: string,
	bucketId: string,
	listId: string,
	requested: number
): Promise<ListDetail> {
	const orgId = await requireBucketOrg(userId, bucketId);

	return withOrgTransaction(orgId, async (client) => {
		if (!(await canOrg(client, userId, orgId, 'system.access'))) throw error(403, 'Forbidden');

		const listResult = await client.query<ListDetail['list']>(
			`SELECT id, name, entity_type, expires_at, created_at
			 FROM universe.list
			 WHERE id = $1 AND bucket = $2 AND org_id = $3`,
			[listId, bucketId, orgId]
		);
		const list = listResult.rows[0];
		if (!list) throw error(404, 'List not found');

		const entries = await queryListEntriesPage(client, orgId, list, requested);

		const turfs = await client.query<ListTurfSummary>(
			`SELECT t.id, t.code, t.expires_at, t.created_at,
			        u.username AS author,
			        s.name AS survey_name,
			        COUNT(tl.id)::text AS location_count,
			        COUNT(tla.id)::text AS attempted_count
			 FROM universe.turf t
			 JOIN auth.user u ON t.author_id = u.id
			 LEFT JOIN universe.survey s ON t.survey_id = s.id AND s.org_id = t.org_id
			 LEFT JOIN universe.turf_location tl ON tl.turf_id = t.id AND tl.org_id = t.org_id
			 LEFT JOIN LATERAL (
			   SELECT id FROM universe.turf_location_attempt
			    WHERE turf_location_id = tl.id AND org_id = t.org_id
			    LIMIT 1
			 ) tla ON true
			 WHERE t.list_id = $1 AND t.org_id = $2
			 GROUP BY t.id, u.username, s.name
			 ORDER BY t.created_at DESC`,
			[listId, orgId]
		);

		const pdf = await client.query(
			`SELECT 1 FROM universe.list_document
			 WHERE list_id = $1 AND org_id = $2 AND status = 'ready' AND deleted_at IS NULL
			 LIMIT 1`,
			[listId, orgId]
		);

		return {
			list,
			entries: entries.items,
			entryCount: entries.totalCount,
			page: entries.page,
			pageSize: entries.pageSize,
			turfs: turfs.rows,
			hasPdf: (pdf.rowCount ?? 0) > 0
		};
	});
}
