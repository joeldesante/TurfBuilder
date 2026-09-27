import type { PoolClient } from 'pg';
import { schemaToSqlQuery } from './query-builder';
import type { StoredBucketFilter } from './filter-converter';
import { rangeInterval, type DashboardRange } from '$lib/dashboard-range';

export type { DashboardRange };

export interface DashboardProgress {
	/** Locations in scope: the bucket's filter matches, or every location in the universe. */
	total: number;
	/** Locations in scope with at least one visit. */
	visited: number;
	/** Locations in scope where someone talked to a canvasser at least once. */
	conversations: number;
	/** Visits to locations in scope, and how many of them reached someone. */
	visits: number;
	answeredVisits: number;
	/** Visits that reached someone in the last 30 days. */
	recentConversations: number;
}

export interface DashboardPoint {
	/** The location's entity id; stable across versions. */
	id: string;
	name: string | null;
	address: string | null;
	longitude: number;
	latitude: number;
	status: 'unvisited' | 'no-contact' | 'contacted';
	visits: number;
	/** ISO timestamp of the latest visit, or null. */
	lastVisitAt: string | null;
}

type DashboardBucket = { id: string; filter: StoredBucketFilter } | null;

/** Most points the map is sent at once. Viewport loading comes later. */
export const MAX_POINTS = 5000;

/**
 * The CTEs shared by every dashboard query:
 *   scope    - locations in scope (current versions, the v_locations view)
 *   attempts - visits in the org, or on turfs cut from the bucket's lists, within
 *              the range, keyed by location entity so older versions still count
 *   scoped   - attempts at locations in scope
 *
 * Buckets are live filters, so scope reads current versions. Returns null when
 * the bucket does not cover locations at all.
 */
function scopeSql(orgId: string, bucket: DashboardBucket, range: DashboardRange, columns: string[]) {
	let sql: string;
	let params: unknown[];

	if (bucket) {
		const query = bucket.filter.locations.enabled ? bucket.filter.locations.query : null;
		if (!query) return null;
		// Same filter the bucket's Locations page runs, with the columns the dashboard needs.
		const [built] = schemaToSqlQuery({
			queries: [{ ...query, select: columns.map((c) => `vl.${c}`) }]
		});
		sql = built.query.replace(/;$/, '');
		params = built.parameters;
	} else {
		sql = `SELECT ${columns.join(', ')} FROM universe.v_locations`;
		params = [];
	}

	const org = `$${params.length + 1}`;
	const bucketId = `$${params.length + 2}`;
	const since = `$${params.length + 3}`;

	const ctes = `
		scope AS (
			SELECT DISTINCT ON (entity_id) * FROM (${sql}) s
		),
		attempts AS (
			SELECT COALESCE(pl.entity_id, ol.entity_id) AS entity_id, a.contact_made, a.created_at
			FROM universe.turf_location_attempt a
			JOIN universe.turf_location tl ON tl.id = a.turf_location_id AND tl.org_id = ${org}
			JOIN universe.turf t ON t.id = tl.turf_id AND t.org_id = ${org}
			JOIN universe.list l ON l.id = t.list_id AND l.org_id = ${org}
			LEFT JOIN universe.public_location pl ON pl.id = tl.public_location_id
			LEFT JOIN universe.org_location ol ON ol.id = tl.org_location_id AND ol.org_id = ${org}
			WHERE a.org_id = ${org}
				AND (${bucketId}::uuid IS NULL OR l.bucket = ${bucketId}::uuid)
				AND (${since}::interval IS NULL OR a.created_at > now() - ${since}::interval)
		),
		scoped AS (
			SELECT attempts.* FROM attempts JOIN scope USING (entity_id)
		)`;

	return { ctes, params: [...params, orgId, bucket?.id ?? null, rangeInterval(range)], nextParam: params.length + 4 };
}

/**
 * Counts how many locations are in scope, how many have been visited, and how
 * many conversations those visits produced. Must run inside withOrgTransaction:
 * v_locations scopes org rows through app.current_org_id.
 */
export async function getDashboardProgress(
	client: PoolClient,
	orgId: string,
	bucket: DashboardBucket,
	range: DashboardRange = 'all'
): Promise<DashboardProgress> {
	const scope = scopeSql(orgId, bucket, range, ['entity_id']);
	if (!scope) {
		return { total: 0, visited: 0, conversations: 0, visits: 0, answeredVisits: 0, recentConversations: 0 };
	}

	const result = await client.query<Record<keyof DashboardProgress, string>>(
		`WITH ${scope.ctes}
		SELECT
			(SELECT count(*) FROM scope) AS total,
			(SELECT count(DISTINCT entity_id) FROM scoped) AS visited,
			(SELECT count(DISTINCT entity_id) FROM scoped WHERE contact_made) AS conversations,
			(SELECT count(*) FROM scoped) AS visits,
			(SELECT count(*) FROM scoped WHERE contact_made) AS "answeredVisits",
			(SELECT count(*) FROM scoped WHERE contact_made AND created_at > now() - interval '30 days') AS "recentConversations"`,
		scope.params
	);

	const row = result.rows[0];
	return {
		total: Number(row?.total ?? 0),
		visited: Number(row?.visited ?? 0),
		conversations: Number(row?.conversations ?? 0),
		visits: Number(row?.visits ?? 0),
		answeredVisits: Number(row?.answeredVisits ?? 0),
		recentConversations: Number(row?.recentConversations ?? 0)
	};
}

/**
 * Every location in scope that has coordinates, with a summary of its visits,
 * for the dashboard map. Capped at MAX_POINTS. Must run inside withOrgTransaction.
 */
export async function getDashboardPoints(
	client: PoolClient,
	orgId: string,
	bucket: DashboardBucket,
	range: DashboardRange = 'all'
): Promise<DashboardPoint[]> {
	const scope = scopeSql(orgId, bucket, range, ['entity_id', 'name', 'address_line_1', 'city', 'coordinates']);
	if (!scope) return [];

	const result = await client.query<{
		id: string;
		name: string | null;
		address_line_1: string | null;
		city: string | null;
		longitude: number;
		latitude: number;
		visits: string;
		contacted: boolean | null;
		last_visit_at: Date | null;
	}>(
		`WITH ${scope.ctes},
		summary AS (
			SELECT entity_id, count(*) AS visits, bool_or(contact_made) AS contacted, max(created_at) AS last_visit_at
			FROM scoped
			GROUP BY entity_id
		)
		SELECT
			s.entity_id AS id, s.name, s.address_line_1, s.city,
			ST_X(s.coordinates) AS longitude, ST_Y(s.coordinates) AS latitude,
			COALESCE(sm.visits, 0) AS visits, sm.contacted, sm.last_visit_at
		FROM scope s
		LEFT JOIN summary sm USING (entity_id)
		WHERE s.coordinates IS NOT NULL
		LIMIT $${scope.nextParam}`,
		[...scope.params, MAX_POINTS]
	);

	return result.rows.map((r) => ({
		id: r.id,
		name: r.name,
		address: [r.address_line_1, r.city].filter(Boolean).join(', ') || null,
		longitude: Number(r.longitude),
		latitude: Number(r.latitude),
		status: Number(r.visits) === 0 ? 'unvisited' : r.contacted ? 'contacted' : 'no-contact',
		visits: Number(r.visits),
		lastVisitAt: r.last_visit_at ? r.last_visit_at.toISOString() : null
	}));
}
