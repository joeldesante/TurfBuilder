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
		logger.error({ err: e, bucketId: row.id }, 'Legacy bucket filter conversion threw an unexpected error; bucket skipped');
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
		logger.error({ bucketId, issues: zodIssues(parsed.error) }, 'Stored bucket filters failed validation');
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
	return (
		parseStored(row.id, row.filters) ?? saveConverted(client, orgId, row.id, convertOld(row))
	);
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
	locations: ['id', 'name', 'address_line_1', 'address_line_2', 'city', 'state_or_region', 'postal_code'],
	people: ['id', 'first_name', 'last_name', 'email', 'phone', 'dob']
} as const satisfies Record<FilterEntity, readonly string[]>;

/**
 * One page of the records a bucket's filter group matches, with the total. A
 * bucket can match far more rows than fit in memory on the server or in the
 * browser, so callers always get a page, never the whole result.
 *
 * The underlying views (universe.v_people, universe.v_locations) filter
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

	const countResult = await client.query<{ count: string }>(
		`SELECT COUNT(*)::text AS count FROM (${query.sql}) q`,
		query.params
	);
	const totalCount = parseInt(countResult.rows[0].count, 10);
	const page = clampPage(requested, totalCount, pageSize);

	const n = query.params.length;
	const result = await client.query(
		`SELECT * FROM (${query.sql}) q ORDER BY ${ORDER[kind]} LIMIT $${n + 1} OFFSET $${n + 2}`,
		[...query.params, pageSize, pageOffset(page, pageSize)]
	);

	return { items: result.rows, totalCount, page, pageSize };
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
		`SELECT ${COLUMNS} FROM universe.bucket WHERE org_id = $1 AND ${column} = $2`,
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
		if (e instanceof UnconvertibleBucketError) return { ...base, filters: null, problem: e.message };
		throw e;
	}
}

/**
 * Every bucket in the organization by name, with the kinds of record each
 * includes, for the sidebar. A bucket that cannot be converted stays in the
 * list with nothing to open. Must run inside withOrgTransaction.
 */
export async function listBucketNavigation(client: PoolClient, orgId: string) {
	const result = await client.query<BucketRow>(
		`SELECT ${COLUMNS} FROM universe.bucket WHERE org_id = $1 ORDER BY name`,
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
		const filters = await resolveBucketFilters(client, orgId, { id: row.id, filter, filters: stored });
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
			`SELECT ${COLUMNS} FROM universe.bucket WHERE org_id = $1 ORDER BY created_at DESC`,
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
			`SELECT ${COLUMNS} FROM universe.bucket WHERE id = $1 AND org_id = $2`,
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
				 WHERE id = $1 AND org_id = $2
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
 * One page of the records a bucket's filters match. An empty page when the
 * bucket does not include that kind of record.
 */
async function listBucketEntities(
	userId: string,
	bucketId: string,
	kind: FilterEntity,
	requested: number
): Promise<Page<Record<string, unknown>>> {
	const orgId = await requireBucketOrg(userId, bucketId);

	return withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		const result = await client.query<BucketRow>(
			`SELECT ${COLUMNS} FROM universe.bucket WHERE id = $1 AND org_id = $2`,
			[bucketId, orgId]
		);
		if (result.rowCount === 0) throw error(404, 'Bucket not found');

		const filters = await resolveOrFail(client, orgId, result.rows[0]);
		const group = filters[kind];
		if (!group) return { items: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE };

		return queryBucketEntitiesPage(client, orgId, kind, group, requested);
	});
}

/** One page of the locations a bucket matches. 404 when it is in none of the caller's orgs. */
export function listBucketLocations(userId: string, bucketId: string, requested: number) {
	return listBucketEntities(userId, bucketId, 'locations', requested);
}

/** One page of the people a bucket matches. 404 when it is in none of the caller's orgs. */
export function listBucketPeople(userId: string, bucketId: string, requested: number) {
	return listBucketEntities(userId, bucketId, 'people', requested);
}
