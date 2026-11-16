import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { POOL, withOrgTransaction } from '$lib/server/database';
import { requireBucketOrg, requireOrgPermission } from '$lib/server/list-access';
import { canOrg } from '$lib/server/permissions';
import { bucketFiltersSchema } from '$lib/shared/schemas/filters';
import type { BucketFilters, FilterEntity, FilterGroup } from '$lib/shared/types/filters';
import { clampPage, pageOffset, PAGE_SIZE } from '$lib/shared/utils/pagination';
import type { Page } from '$lib/shared/utils/pagination';
import { buildFilterQuery, convertStoredBucketFilter, LegacyFilterError } from './filters.service';
import type { FilterQuery } from './filters.service';
import { envelopes } from './locations.service';
import type { BucketMapViewportQuery } from '$lib/shared/schemas/bucket-map';
import type {
	BucketMapOverview,
	BucketMapPoint,
	BucketMapViewport
} from '$lib/shared/types/bucket-map';
import { logger, zodIssues } from '$lib/server/logger';

export interface BucketInput {
	name: string;
	slug: string;
	filters: BucketFilters;
}

export interface Bucket {
	id: string;
	org_id: string;
	name: string;
	slug: string;
	/** What the bucket selects, or null for a bucket made before the filter editor whose old filter cannot be converted. */
	filters: BucketFilters | null;
	created_at: string;
}

/** A bucket row as stored, with both the old and the new filter column. */
interface BucketRow extends Omit<Bucket, 'filters'> {
	filter: unknown;
	filters: unknown;
}

// There are no bucket.* permission keys yet, so buckets use the same staff
// check as list documents.
const PERMISSION = 'system.access';

const COLUMNS = 'id, org_id, name, slug, filter, filters, created_at';

const UNIQUE_VIOLATION = '23505';

function isSlugTaken(e: unknown): boolean {
	return (e as { code?: string })?.code === UNIQUE_VIOLATION;
}

async function requireStaff(client: PoolClient, userId: string, orgId: string) {
	if (!(await canOrg(client, userId, orgId, PERMISSION))) throw error(403, 'Forbidden');
}

// ---------------------------------------------------------------------------
// A bucket's filters
//
// They live in `universe.bucket.filters` as the filter editor's document.
// Buckets made before that column existed only have the old compiled query in
// `filter`; those are converted the first time they are read, and the result
// is saved so it happens once. Everything that needs a bucket's filters goes
// through `resolveBucketFilters`, so that nothing reads the old column
// directly. That is what lets the old column be dropped once every bucket has
// been converted (see issue #221).
// ---------------------------------------------------------------------------

/** The columns `resolveBucketFilters` needs from a bucket row. */
export interface BucketFiltersRow {
	id: string;
	filter: unknown;
	filters: unknown;
}

/** A bucket whose old filter has no faithful equivalent, so it cannot be used until it is rebuilt. */
export class UnconvertibleBucketError extends Error {
	constructor(
		readonly bucketId: string,
		readonly reason: string
	) {
		super(`This bucket's filters could not be converted: ${reason}`);
	}
}

/**
 * A bucket whose saved filters no longer pass the schema, for example after a
 * filter or operation is removed. It is handled like an unconvertible bucket, so
 * one bad bucket cannot break every staff page, and its Filters page still opens
 * so the filters can be rebuilt.
 */
export class InvalidBucketFiltersError extends UnconvertibleBucketError {
	constructor(bucketId: string, reason: string) {
		super(bucketId, reason);
		this.message = `This bucket's saved filters are no longer valid: ${reason}. Rebuild them on the Filters page.`;
	}
}

/** Converts a bucket's old filter, or throws `UnconvertibleBucketError`. */
function convertOld(row: BucketFiltersRow): BucketFilters {
	try {
		return convertStoredBucketFilter(row.filter);
	} catch (e) {
		if (e instanceof LegacyFilterError) throw new UnconvertibleBucketError(row.id, e.message);
		// Stored filters are untrusted JSON. A shape nobody foresaw must not break the
		// migration for every other bucket, so it is reported like any other failure.
		logger.error(
			{ err: e, bucketId: row.id },
			'Legacy bucket filter conversion threw an unexpected error; bucket skipped'
		);
		throw new UnconvertibleBucketError(
			row.id,
			`unexpected error while converting: ${e instanceof Error ? e.message : String(e)}`
		);
	}
}

function parseStored(bucketId: string, stored: unknown): BucketFilters | null {
	if (stored === null || stored === undefined) return null;
	const parsed = bucketFiltersSchema.safeParse(stored);
	if (!parsed.success) {
		const reason = parsed.error.issues[0]?.message ?? 'unknown problem';
		logger.error(
			{ bucketId, issues: zodIssues(parsed.error) },
			'Stored bucket filters failed validation'
		);
		throw new InvalidBucketFiltersError(bucketId, reason);
	}
	return parsed.data;
}

/**
 * Saves converted filters unless someone else already saved some, in which case
 * theirs win. Returns what is stored either way. Must run inside withOrgTransaction.
 */
async function saveConverted(
	client: PoolClient,
	orgId: string,
	bucketId: string,
	converted: BucketFilters
): Promise<BucketFilters> {
	const saved = await client.query<{ filters: unknown }>(
		`UPDATE universe.bucket SET filters = $3::jsonb
		  WHERE id = $1 AND org_id = $2 AND filters IS NULL
		  RETURNING filters`,
		[bucketId, orgId, JSON.stringify(converted)]
	);
	if (saved.rowCount) return converted;

	const current = await client.query<{ filters: unknown }>(
		`SELECT filters FROM universe.bucket WHERE id = $1 AND org_id = $2`,
		[bucketId, orgId]
	);
	return parseStored(bucketId, current.rows[0]?.filters) ?? converted;
}

/**
 * A bucket's filters. Converts and saves the old filter first if the bucket has
 * not been converted yet. Throws `UnconvertibleBucketError` when it cannot be.
 * Must run inside withOrgTransaction.
 */
export async function resolveBucketFilters(
	client: PoolClient,
	orgId: string,
	row: BucketFiltersRow
): Promise<BucketFilters> {
	return parseStored(row.id, row.filters) ?? saveConverted(client, orgId, row.id, convertOld(row));
}

/** `resolveBucketFilters`, answering an unconvertible bucket with a 422 that says why. */
async function resolveOrFail(
	client: PoolClient,
	orgId: string,
	row: BucketFiltersRow
): Promise<BucketFilters> {
	try {
		return await resolveBucketFilters(client, orgId, row);
	} catch (e) {
		if (e instanceof UnconvertibleBucketError) throw error(422, e.message);
		throw e;
	}
}

/** Which kinds of record a bucket includes, for navigation that does not need the filters themselves. */
export function bucketSections(filters: BucketFilters): {
	people: { enabled: boolean };
	locations: { enabled: boolean };
} {
	return {
		people: { enabled: filters.people !== null },
		locations: { enabled: filters.locations !== null }
	};
}

export interface ConversionReport {
	/** Buckets converted by this run. */
	converted: number;
	/** Buckets that already had filters. */
	alreadyDone: number;
	/** Buckets that could not be converted, and why. They keep working only through their old filter. */
	failed: { orgId: string; bucketId: string; slug: string; reason: string }[];
}

/**
 * Converts every bucket that has not been yet, across all organizations, and
 * reports the ones that could not be. Safe to run repeatedly.
 */
export async function convertAllBucketFilters(): Promise<ConversionReport> {
	const report: ConversionReport = { converted: 0, alreadyDone: 0, failed: [] };
	const orgs = await POOL.query<{ id: string }>(`SELECT id FROM auth.organization`);

	for (const { id: orgId } of orgs.rows) {
		await withOrgTransaction(orgId, async (client) => {
			const buckets = await client.query<BucketFiltersRow & { slug: string }>(
				`SELECT id, slug, filter, filters FROM universe.bucket WHERE org_id = $1`,
				[orgId]
			);

			for (const row of buckets.rows) {
				if (row.filters !== null) {
					report.alreadyDone++;
					continue;
				}
				try {
					await saveConverted(client, orgId, row.id, convertOld(row));
					report.converted++;
				} catch (e) {
					if (!(e instanceof UnconvertibleBucketError)) throw e;
					report.failed.push({ orgId, bucketId: row.id, slug: row.slug, reason: e.reason });
				}
			}
		});
	}

	return report;
}

// ---------------------------------------------------------------------------
// The records a bucket holds
// ---------------------------------------------------------------------------

/** Sort orders for a bucket's records. They end in `id` so the order is total and pages never overlap or skip rows. */
const ORDER = {
	locations: 'name NULLS LAST, address_line_1 NULLS LAST, id',
	people: 'last_name NULLS LAST, first_name NULLS LAST, id'
} as const satisfies Record<FilterEntity, string>;

/** The columns the bucket pages show for each kind of record. */
const PAGE_COLUMNS = {
	locations: [
		'id',
		'name',
		'address_line_1',
		'address_line_2',
		'city',
		'state_or_region',
		'postal_code'
	],
	people: ['id', 'first_name', 'last_name', 'email', 'phone', 'dob']
} as const satisfies Record<FilterEntity, readonly string[]>;

/**
 * One page of the records a bucket's filter group matches, with the total. A
 * bucket can match far more rows than fit in memory on the server or in the
 * browser, so callers always get a page, never the whole result.
 *
 * The underlying views (universe.v_people, universe.v_contacts) filter
 * org-owned rows using current_setting('app.current_org_id'), and the filters'
 * subqueries are filtered by `orgId`. Must run inside withOrgTransaction.
 */
export async function queryBucketEntitiesPage(
	client: PoolClient,
	orgId: string,
	kind: FilterEntity,
	group: FilterGroup,
	requested: number,
	pageSize = PAGE_SIZE
): Promise<Page<Record<string, unknown>>> {
	const query: FilterQuery = buildFilterQuery(kind, group, { orgId, columns: PAGE_COLUMNS[kind] });
	const n = query.params.length;

	// One pass for the page and the total. MATERIALIZED makes Postgres find the matches first and
	// sort only those; left to itself it walks every record in name order to fill the page, which
	// sorted all 400,000 contacts to show 100 of them. The window count sees every match, not just
	// the page, because it runs before LIMIT.
	const pageOf = (page: number) =>
		client.query<Record<string, unknown> & { total_count: string }>(
			`WITH matches AS MATERIALIZED (${query.sql})
			 SELECT *, COUNT(*) OVER ()::text AS total_count FROM matches
			 ORDER BY ${ORDER[kind]} LIMIT $${n + 1} OFFSET $${n + 2}`,
			[...query.params, pageSize, pageOffset(page, pageSize)]
		);

	let page = Math.max(1, Math.floor(requested) || 1);
	let result = await pageOf(page);
	let totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;

	// A page past the end comes back empty and so cannot say the total: count, and fetch the last page.
	if (result.rows.length === 0 && page > 1) {
		const countResult = await client.query<{ count: string }>(
			`SELECT COUNT(*)::text AS count FROM (${query.sql}) q`,
			query.params
		);
		totalCount = parseInt(countResult.rows[0].count, 10);
		page = clampPage(requested, totalCount, pageSize);
		if (totalCount > 0) result = await pageOf(page);
	}

	const items = result.rows.map(({ total_count: _, ...row }) => row);
	return { items, totalCount, page: totalCount === 0 ? 1 : page, pageSize };
}

/** How many entities of one kind a bucket's filter group matches. Must run inside withOrgTransaction. */
export async function countBucketEntities(
	client: PoolClient,
	orgId: string,
	kind: FilterEntity,
	group: FilterGroup
): Promise<number> {
	const query = buildFilterQuery(kind, group, { orgId, columns: PAGE_COLUMNS[kind] });
	const result = await client.query<{ count: string }>(
		`SELECT COUNT(*)::text AS count FROM (${query.sql}) q`,
		query.params
	);
	return parseInt(result.rows[0].count, 10);
}

// ---------------------------------------------------------------------------
// Finding buckets, for pages and layouts
// ---------------------------------------------------------------------------

type FoundBucket = { id: string; name: string; slug: string; filters: BucketFilters };

/** A bucket as the pages inside it see it: `filters` is null, with the reason, when its old filter cannot be converted. */
export type BucketForPage =
	| (FoundBucket & { problem: null })
	| (Omit<FoundBucket, 'filters'> & { filters: null; problem: string });

/** Finds one bucket by a column of the organization's buckets, without resolving its filters. */
async function selectBucket(
	client: PoolClient,
	orgId: string,
	column: 'id' | 'slug',
	value: string
): Promise<BucketRow | null> {
	const result = await client.query<BucketRow>(
		`SELECT ${COLUMNS} FROM universe.bucket
		  WHERE org_id = $1 AND ${column} = $2 AND deleted_at IS NULL`,
		[orgId, value]
	);
	return result.rows[0] ?? null;
}

async function findBucket(
	client: PoolClient,
	orgId: string,
	column: 'id' | 'slug',
	value: string
): Promise<FoundBucket | null> {
	const row = await selectBucket(client, orgId, column, value);
	if (!row) return null;

	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		filters: await resolveOrFail(client, orgId, row)
	};
}

/**
 * A bucket by slug with its filters, or null when the organization has none by
 * that slug. 422 when its old filter cannot be converted. Must run inside
 * withOrgTransaction.
 */
export function findBucketBySlug(client: PoolClient, orgId: string, slug: string) {
	return findBucket(client, orgId, 'slug', slug);
}

/** `findBucketBySlug`, by id. */
export function findBucketById(client: PoolClient, orgId: string, bucketId: string) {
	return findBucket(client, orgId, 'id', bucketId);
}

/**
 * `findBucketBySlug` for the pages inside a bucket. A bucket whose old filter
 * cannot be converted is still returned, with the reason, so that its filters
 * page can open and let it be rebuilt; the other pages answer with the reason.
 */
export async function findBucketForPage(
	client: PoolClient,
	orgId: string,
	slug: string
): Promise<BucketForPage | null> {
	const row = await selectBucket(client, orgId, 'slug', slug);
	if (!row) return null;

	const base = { id: row.id, name: row.name, slug: row.slug };
	try {
		const filters = await resolveBucketFilters(client, orgId, row);
		return { ...base, filters, problem: null };
	} catch (e) {
		if (e instanceof UnconvertibleBucketError)
			return { ...base, filters: null, problem: e.message };
		throw e;
	}
}

/**
 * What every page inside a bucket needs: the bucket by slug. 403 without staff
 * access, 404 when the organization has no bucket by that slug. How many
 * locations it matches is countBucketLocations(), kept apart so a page does not
 * wait for the count.
 */
export async function getBucketPage(
	userId: string,
	orgId: string,
	slug: string
): Promise<{ bucket: BucketForPage }> {
	return withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		const bucket = await findBucketForPage(client, orgId, slug);
		if (!bucket) throw error(404, 'Bucket not found');

		return { bucket };
	});
}

/**
 * How many locations a bucket matches, or null when it does not include
 * locations. 404 when it is in none of the caller's orgs, 403 without staff
 * access.
 */
export function countBucketLocations(userId: string, bucketId: string): Promise<number | null> {
	return withBucketGroup<number | null>(userId, bucketId, 'locations', null, (client, orgId, group) =>
		countBucketEntities(client, orgId, 'locations', group)
	);
}

/**
 * Every bucket in the organization by name, with the kinds of record each
 * includes, for the sidebar. A bucket that cannot be converted stays in the
 * list with nothing to open. Must run inside withOrgTransaction.
 */
export async function listBucketNavigation(client: PoolClient, orgId: string) {
	const result = await client.query<BucketRow>(
		`SELECT ${COLUMNS} FROM universe.bucket WHERE org_id = $1 AND deleted_at IS NULL ORDER BY name`,
		[orgId]
	);

	const buckets = [];
	for (const row of result.rows) {
		let filter = { people: { enabled: false }, locations: { enabled: false } };
		try {
			filter = bucketSections(await resolveBucketFilters(client, orgId, row));
		} catch (e) {
			if (!(e instanceof UnconvertibleBucketError)) throw e;
		}
		buckets.push({ id: row.id, name: row.name, slug: row.slug, filter });
	}
	return buckets;
}

/** `listBucketNavigation` for the staff layout. 403 without staff access. */
export async function getBucketNavigation(userId: string, orgId: string) {
	return withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);
		return listBucketNavigation(client, orgId);
	});
}

// ---------------------------------------------------------------------------
// Buckets, for the API
// ---------------------------------------------------------------------------

/**
 * A stored row as the API returns it. A bucket that has not been converted is
 * converted now; one that cannot be gets null rather than failing the request.
 */
async function toBucket(client: PoolClient, orgId: string, row: BucketRow): Promise<Bucket> {
	const { filter, filters: stored, ...rest } = row;
	try {
		const filters = await resolveBucketFilters(client, orgId, {
			id: row.id,
			filter,
			filters: stored
		});
		return { ...rest, filters };
	} catch (e) {
		if (e instanceof UnconvertibleBucketError) return { ...rest, filters: null };
		throw e;
	}
}

/** The organization's buckets, newest first. 404 unless the caller is a member, 403 without staff access. */
export async function listBuckets(userId: string, orgId: string): Promise<Bucket[]> {
	await requireOrgPermission(userId, orgId, PERMISSION);

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<BucketRow>(
			`SELECT ${COLUMNS} FROM universe.bucket
			 WHERE org_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
			[orgId]
		);
		const buckets: Bucket[] = [];
		for (const row of result.rows) buckets.push(await toBucket(client, orgId, row));
		return buckets;
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
			const result = await client.query<BucketRow>(
				`INSERT INTO universe.bucket (name, slug, org_id, filters)
				 VALUES ($1, $2, $3, $4)
				 RETURNING ${COLUMNS}`,
				[input.name, input.slug, orgId, JSON.stringify(input.filters)]
			);
			return toBucket(client, orgId, result.rows[0]);
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

		const result = await client.query<BucketRow>(
			`SELECT ${COLUMNS} FROM universe.bucket
			 WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
			[bucketId, orgId]
		);
		if (result.rowCount === 0) throw error(404, 'Bucket not found');
		return toBucket(client, orgId, result.rows[0]);
	});
}

/** Replaces a bucket's name, slug, and filters. 409 when the slug is taken in its org. */
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
			const result = await client.query<BucketRow>(
				`UPDATE universe.bucket
				 SET name = COALESCE($3, name),
				     slug = COALESCE($4, slug),
				     filters = COALESCE($5::jsonb, filters)
				 WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
				 RETURNING ${COLUMNS}`,
				[
					bucketId,
					orgId,
					input.name ?? null,
					input.slug ?? null,
					input.filters === undefined ? null : JSON.stringify(input.filters)
				]
			);
			if (result.rowCount === 0) throw error(404, 'Bucket not found');
			return toBucket(client, orgId, result.rows[0]);
		});
	} catch (e) {
		if (isSlugTaken(e)) throw error(409, 'A bucket with that slug already exists');
		throw e;
	}
}

/**
 * Deletes a bucket without removing it: the row is marked deleted, so it drops
 * out of every list and its pages answer 404, while its lists, surveys, scripts,
 * and turfs stay as they are. Its slug is free to use again. 404 when it is in
 * none of the caller's orgs or is already deleted, 403 without staff access.
 */
export async function deleteBucket(userId: string, bucketId: string): Promise<void> {
	const orgId = await requireBucketOrg(userId, bucketId);

	await withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		const result = await client.query(
			`UPDATE universe.bucket SET deleted_at = now()
			 WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
			[bucketId, orgId]
		);
		if (result.rowCount === 0) throw error(404, 'Bucket not found');
	});
}

/**
 * Runs `fn` with the filter group a bucket uses for one kind of record, or
 * answers `empty` when the bucket does not include that kind. 404 when the
 * bucket is in none of the caller's orgs, 403 without staff access.
 */
async function withBucketGroup<T>(
	userId: string,
	bucketId: string,
	kind: FilterEntity,
	empty: T,
	fn: (client: PoolClient, orgId: string, group: FilterGroup) => Promise<T>
): Promise<T> {
	const orgId = await requireBucketOrg(userId, bucketId);

	return withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		const result = await client.query<BucketRow>(
			`SELECT ${COLUMNS} FROM universe.bucket
			 WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
			[bucketId, orgId]
		);
		if (result.rowCount === 0) throw error(404, 'Bucket not found');

		const filters = await resolveOrFail(client, orgId, result.rows[0]);
		const group = filters[kind];
		if (!group) return empty;

		return fn(client, orgId, group);
	});
}

/**
 * One page of the records a bucket's filters match. An empty page when the
 * bucket does not include that kind of record.
 */
function listBucketEntities(
	userId: string,
	bucketId: string,
	kind: FilterEntity,
	requested: number
): Promise<Page<Record<string, unknown>>> {
	return withBucketGroup(
		userId,
		bucketId,
		kind,
		{ items: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE },
		(client, orgId, group) => queryBucketEntitiesPage(client, orgId, kind, group, requested)
	);
}

// ---------------------------------------------------------------------------
// The bucket map
//
// A bucket can match far more locations than a browser can draw, so the map
// asks for one viewport at a time. A viewport with few enough locations gets
// them as single points; a fuller one gets them merged into counted bubbles on
// a grid sized to the zoom, so every location is still accounted for.
// ---------------------------------------------------------------------------

/** A viewport holding at most this many locations gets them all as single points. */
export const MAX_MAP_POINTS = 2000;

/** The width of a bubble's grid cell on screen, in pixels. */
const CLUSTER_CELL_PX = 60;

/**
 * The grid cell size in degrees of longitude for a zoom: CLUSTER_CELL_PX on
 * screen. MapLibre draws the world 512 pixels wide at zoom 0.
 */
export function clusterCellDegrees(zoom: number): number {
	return (360 / (512 * 2 ** zoom)) * CLUSTER_CELL_PX;
}

/** The bucket's locations with a position, as one subquery over the bucket's filters. */
function positionedLocations(orgId: string, group: FilterGroup) {
	const query = buildFilterQuery('locations', group, {
		orgId,
		columns: ['id', 'name', 'address_line_1', 'city', 'coordinates']
	});
	return {
		sql: `SELECT * FROM (${query.sql}) q WHERE coordinates IS NOT NULL`,
		params: query.params
	};
}

/**
 * The bucket map's opening view: how many located matches there are and the
 * box around them. Empty when the bucket does not include locations. 404 when
 * it is in none of the caller's orgs, 403 without staff access.
 */
export function getBucketMapOverview(userId: string, bucketId: string): Promise<BucketMapOverview> {
	return withBucketGroup(
		userId,
		bucketId,
		'locations',
		{ total: 0, bounds: null },
		async (client, orgId, group) => {
			const located = positionedLocations(orgId, group);
			const result = await client.query<{
				total: number;
				west: number | null;
				south: number | null;
				east: number | null;
				north: number | null;
			}>(
				`SELECT count(*)::int AS total,
				        ST_XMin(ST_Extent(coordinates)) AS west, ST_YMin(ST_Extent(coordinates)) AS south,
				        ST_XMax(ST_Extent(coordinates)) AS east, ST_YMax(ST_Extent(coordinates)) AS north
				 FROM (${located.sql}) located`,
				located.params
			);
			const row = result.rows[0];
			return {
				total: row.total,
				bounds:
					row.west === null
						? null
						: { west: row.west, south: row.south!, east: row.east!, north: row.north! }
			};
		}
	);
}

/**
 * What the bucket map draws for one viewport. Up to MAX_MAP_POINTS located
 * matches come back as single points. Past that they are merged per grid cell
 * (see clusterCellDegrees); a cell holding one location still comes back as a
 * point. Empty when the bucket does not include locations. 404 when it is in
 * none of the caller's orgs, 403 without staff access.
 */
export function getBucketMapViewport(
	userId: string,
	bucketId: string,
	viewport: BucketMapViewportQuery
): Promise<BucketMapViewport> {
	return withBucketGroup(
		userId,
		bucketId,
		'locations',
		{ points: [], clusters: [] },
		async (client, orgId, group) => {
			const located = positionedLocations(orgId, group);
			const n = located.params.length;
			const boxes = envelopes(viewport);
			const inView = boxes
				.map((_, i) => {
					const p = n + 1 + i * 4;
					return `coordinates && ST_MakeEnvelope($${p}, $${p + 1}, $${p + 2}, $${p + 3}, 4326)`;
				})
				.join(' OR ');
			const visible = `SELECT * FROM (${located.sql}) located WHERE ${inView}`;
			const params = [...located.params, ...boxes.flat()];

			// One past the limit says whether the viewport is too full for single points.
			const points = await client.query<BucketMapPoint>(
				`SELECT id, name, address_line_1, city,
				        ST_Y(coordinates) AS latitude, ST_X(coordinates) AS longitude
				 FROM (${visible}) v
				 LIMIT ${MAX_MAP_POINTS + 1}`,
				params
			);
			if (points.rows.length <= MAX_MAP_POINTS) return { points: points.rows, clusters: [] };

			const cell = clusterCellDegrees(viewport.zoom);
			const cells = await client.query<{
				cell_x: number;
				cell_y: number;
				count: number;
				latitude: number;
				longitude: number;
				id: string | null;
				name: string | null;
				address_line_1: string | null;
				city: string | null;
			}>(
				`SELECT floor(ST_X(coordinates) / $${params.length + 1})::bigint AS cell_x,
				        floor(ST_Y(coordinates) / $${params.length + 1})::bigint AS cell_y,
				        count(*)::int AS count,
				        avg(ST_Y(coordinates)) AS latitude, avg(ST_X(coordinates)) AS longitude,
				        (array_agg(id))[1]::text AS id, (array_agg(name))[1] AS name,
				        (array_agg(address_line_1))[1] AS address_line_1, (array_agg(city))[1] AS city
				 FROM (${visible}) v
				 GROUP BY cell_x, cell_y`,
				[...params, cell]
			);

			const result: BucketMapViewport = { points: [], clusters: [] };
			for (const c of cells.rows) {
				if (c.count === 1) {
					result.points.push({
						id: c.id!,
						name: c.name,
						address_line_1: c.address_line_1,
						city: c.city,
						latitude: c.latitude,
						longitude: c.longitude
					});
				} else {
					result.clusters.push({
						id: `${viewport.zoom.toFixed(0)}:${c.cell_x}:${c.cell_y}`,
						latitude: c.latitude,
						longitude: c.longitude,
						count: c.count
					});
				}
			}
			return result;
		}
	);
}

/** One page of the locations a bucket matches. 404 when it is in none of the caller's orgs. */
export function listBucketLocations(userId: string, bucketId: string, requested: number) {
	return listBucketEntities(userId, bucketId, 'locations', requested);
}

/** One page of the people a bucket matches. 404 when it is in none of the caller's orgs. */
export function listBucketPeople(userId: string, bucketId: string, requested: number) {
	return listBucketEntities(userId, bucketId, 'people', requested);
}
