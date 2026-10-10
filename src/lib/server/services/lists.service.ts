import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import { requireBucketOrg, requireListAccess, requireListOrg } from '$lib/server/list-access';
import { clampPage, pageOffset, PAGE_SIZE } from '$lib/server/pagination';
import type { Page } from '$lib/server/pagination';
import { canOrg } from '$lib/server/permissions';

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
						COALESCE(pp.entity_id, op.entity_id)::text AS entity_id,
						COALESCE(pp.first_name, op.first_name) AS first_name,
						COALESCE(pp.last_name,  op.last_name)  AS last_name,
						COALESCE(pp.email,      op.email)      AS email,
						COALESCE(pp.phone,      op.phone)      AS phone
					FROM universe.list_entry le
					JOIN universe.list l ON l.id = le.list_id AND l.org_id = $2
					LEFT JOIN universe.public_person pp
						ON le.record_source = 'public_person' AND pp.id = le.record_id
					LEFT JOIN universe.org_person op
						ON le.record_source = 'org_person'    AND op.id = le.record_id
					WHERE le.list_id = $1
					ORDER BY
						COALESCE(pp.last_name,  op.last_name),
						COALESCE(pp.first_name, op.first_name),
						le.id
					LIMIT $3 OFFSET $4`,
					params
				)
			: await client.query<LocationEntry>(
					`SELECT
						le.record_id,
						le.record_source,
						COALESCE(pl.entity_id, ol.entity_id)::text AS entity_id,
						COALESCE(pl.name,           ol.name)           AS name,
						COALESCE(pl.address_line_1, ol.address_line_1) AS address_line_1,
						COALESCE(pl.city,           ol.city)           AS city,
						COALESCE(pl.state_or_region,ol.state_or_region)AS state_or_region,
						COALESCE(pl.postal_code,    ol.postal_code)    AS postal_code
					FROM universe.list_entry le
					JOIN universe.list l ON l.id = le.list_id AND l.org_id = $2
					LEFT JOIN universe.public_location pl
						ON le.record_source = 'public_location' AND pl.id = le.record_id
					LEFT JOIN universe.org_location ol
						ON le.record_source = 'org_location'    AND ol.id = le.record_id
					WHERE le.list_id = $1
					ORDER BY
						COALESCE(pl.city,  ol.city),
						COALESCE(pl.name,  ol.name),
						le.id
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
