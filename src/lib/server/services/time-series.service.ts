import type { PoolClient } from 'pg';
import type { POOL } from '$lib/server/database';
import type { Granularity, TimePoint } from '$lib/shared/types/charts';

type Db = PoolClient | typeof POOL;

/**
 * What can be counted over time. Each source names its table, its timestamp,
 * the column that scopes it to an org, and the columns callers may filter on.
 * Nothing here comes from input, so the SQL built from it is safe; values are
 * always parameters.
 *
 * Platform tables (activity_event, auth.*) can be counted with POOL across
 * every org. Universe tables are behind org RLS: count them inside
 * withOrgTransaction with `orgId` set.
 */
export const TIME_SERIES_SOURCES = {
	activity_events: {
		table: 'activity_event',
		timestamp: 'occurred_at',
		orgColumn: 'org_id',
		filters: { type: 'type', userId: 'user_id', contactMade: "(metadata->>'contact_made')" },
		distinct: { users: 'user_id', orgs: 'org_id' }
	},
	users: {
		table: 'auth.user',
		timestamp: 'created_at',
		orgColumn: null,
		filters: { emailVerified: 'email_verified' },
		distinct: {}
	},
	organizations: {
		table: 'auth.organization',
		timestamp: 'created_at',
		orgColumn: null,
		filters: {},
		distinct: {}
	},
	members: {
		table: 'auth.member',
		timestamp: 'created_at',
		orgColumn: 'organization_id',
		filters: {},
		distinct: {}
	},
	emails: {
		table: 'email_log',
		timestamp: 'created_at',
		orgColumn: null,
		filters: { status: 'status', template: 'template' },
		distinct: {}
	},
	canvass_visits: {
		table: 'universe.turf_location_attempt',
		timestamp: 'created_at',
		orgColumn: 'org_id',
		filters: { contactMade: 'contact_made', userId: 'user_id' },
		distinct: { users: 'user_id' }
	},
	lists: {
		table: 'universe.list',
		timestamp: 'created_at',
		orgColumn: 'org_id',
		filters: {},
		distinct: {}
	},
	turfs: {
		table: 'universe.turf',
		timestamp: 'created_at',
		orgColumn: 'org_id',
		filters: {},
		distinct: {}
	}
} as const satisfies Record<
	string,
	{
		table: string;
		timestamp: string;
		orgColumn: string | null;
		filters: Record<string, string>;
		distinct: Record<string, string>;
	}
>;

export type TimeSeriesSource = keyof typeof TIME_SERIES_SOURCES;

const GRANULARITIES: Granularity[] = ['day', 'week', 'month'];

export interface TimeSeriesQuery<S extends TimeSeriesSource> {
	source: S;
	/** First instant counted (inclusive). */
	from: Date;
	/** Last instant counted (inclusive); now when omitted. */
	to?: Date;
	granularity: Granularity;
	/** Scope to one org. Required for universe sources, which RLS hides otherwise. */
	orgId?: string;
	/** Equality filters on the source's allow-listed columns. */
	where?: Partial<Record<keyof (typeof TIME_SERIES_SOURCES)[S]['filters'], string | boolean | number>>;
	/** Count distinct values of an allow-listed column instead of rows. */
	distinct?: keyof (typeof TIME_SERIES_SOURCES)[S]['distinct'];
}

function checkGranularity(granularity: Granularity): Granularity {
	if (!GRANULARITIES.includes(granularity)) throw new Error(`Unknown granularity: ${granularity}`);
	return granularity;
}

/**
 * Counts rows per bucket, with every bucket from `from` to `to` present
 * (empty ones as zero). Buckets are UTC days, Monday weeks, or months, as
 * `date_trunc` makes them, so the dates match `bucketStart` in chart-series.
 */
export async function timeSeries<S extends TimeSeriesSource>(db: Db, query: TimeSeriesQuery<S>): Promise<TimePoint[]> {
	const source = TIME_SERIES_SOURCES[query.source];
	if (!source) throw new Error(`Unknown time series source: ${String(query.source)}`);
	const granularity = checkGranularity(query.granularity);

	const params: unknown[] = [granularity, query.from, query.to ?? new Date()];
	const clauses = [`t.${source.timestamp} >= $2`, `t.${source.timestamp} <= $3`];

	if (query.orgId) {
		if (!source.orgColumn) throw new Error(`${String(query.source)} cannot be scoped to an org`);
		params.push(query.orgId);
		clauses.push(`t.${source.orgColumn} = $${params.length}`);
	}
	for (const [key, value] of Object.entries(query.where ?? {})) {
		const column = (source.filters as Record<string, string>)[key];
		if (!column) throw new Error(`Cannot filter ${String(query.source)} by ${key}`);
		params.push(typeof value === 'boolean' ? String(value) : value);
		// Compare as text so booleans, enums, and JSON fields share one form.
		clauses.push(`${column.startsWith('(') ? column : `t.${column}`}::text = $${params.length}::text`);
	}

	let measure = 'COUNT(*)';
	if (query.distinct) {
		const column = (source.distinct as Record<string, string>)[query.distinct as string];
		if (!column) throw new Error(`Cannot count distinct ${String(query.distinct)} in ${String(query.source)}`);
		measure = `COUNT(DISTINCT t.${column})`;
	}

	const result = await db.query<{ date: string; value: string }>(
		`WITH buckets AS (
		   SELECT generate_series(
		     date_trunc($1, ($2::timestamptz AT TIME ZONE 'UTC')),
		     date_trunc($1, ($3::timestamptz AT TIME ZONE 'UTC')),
		     ('1 ' || $1)::interval
		   ) AS bucket
		 ),
		 counts AS (
		   SELECT date_trunc($1, (t.${source.timestamp}::timestamptz AT TIME ZONE 'UTC')) AS bucket, ${measure} AS n
		   FROM ${source.table} t
		   WHERE ${clauses.join(' AND ')}
		   GROUP BY 1
		 )
		 SELECT to_char(b.bucket, 'YYYY-MM-DD') AS date, COALESCE(c.n, 0) AS value
		 FROM buckets b
		 LEFT JOIN counts c USING (bucket)
		 ORDER BY b.bucket`,
		params
	);

	return result.rows.map((r) => ({ date: r.date, value: Number(r.value) }));
}

/** Rows of the source created before `before`: the starting point for a cumulative series. */
export async function countBefore<S extends TimeSeriesSource>(
	db: Db,
	source: S,
	before: Date,
	orgId?: string
): Promise<number> {
	const s = TIME_SERIES_SOURCES[source];
	const params: unknown[] = [before];
	let org = '';
	if (orgId && s.orgColumn) {
		params.push(orgId);
		org = ` AND t.${s.orgColumn} = $2`;
	}
	const result = await db.query<{ n: string }>(
		`SELECT COUNT(*) AS n FROM ${s.table} t WHERE t.${s.timestamp} < $1${org}`,
		params
	);
	return Number(result.rows[0]?.n ?? 0);
}

/** When the source's first row was made, for an "all time" range; null when it is empty. */
export async function earliest<S extends TimeSeriesSource>(db: Db, source: S, orgId?: string): Promise<Date | null> {
	const s = TIME_SERIES_SOURCES[source];
	const params: unknown[] = [];
	let org = '';
	if (orgId && s.orgColumn) {
		params.push(orgId);
		org = ` WHERE t.${s.orgColumn} = $1`;
	}
	const result = await db.query<{ first: Date | null }>(`SELECT min(t.${s.timestamp}) AS first FROM ${s.table} t${org}`, params);
	const first = result.rows[0]?.first;
	return first ? new Date(first) : null;
}

/**
 * People active in a trailing window ending at each bucket's last day (or
 * today, for the current bucket): with `windowDays` 1, 7, and 30 that is DAU,
 * WAU, and MAU. Reads user_activity_day, platform-wide or for one org.
 */
export async function rollingActiveUsers(
	db: Db,
	options: { from: Date; to?: Date; granularity: Granularity; windowDays: number; orgId?: string }
): Promise<TimePoint[]> {
	const granularity = checkGranularity(options.granularity);
	const windowDays = Math.max(1, Math.min(366, Math.floor(options.windowDays)));

	const result = await db.query<{ date: string; value: string }>(
		`WITH buckets AS (
		   SELECT b AS bucket,
		          LEAST((b + ('1 ' || $1)::interval - interval '1 day')::date, current_date) AS last_day
		   FROM generate_series(
		     date_trunc($1, ($2::timestamptz AT TIME ZONE 'UTC')),
		     date_trunc($1, ($3::timestamptz AT TIME ZONE 'UTC')),
		     ('1 ' || $1)::interval
		   ) AS b
		 )
		 SELECT to_char(b.bucket, 'YYYY-MM-DD') AS date,
		        (SELECT COUNT(DISTINCT d.user_id) FROM user_activity_day d
		         WHERE d.org_key = $4 AND d.day > b.last_day - $5::int AND d.day <= b.last_day) AS value
		 FROM buckets b
		 ORDER BY b.bucket`,
		[granularity, options.from, options.to ?? new Date(), options.orgId ?? '', windowDays]
	);

	return result.rows.map((r) => ({ date: r.date, value: Number(r.value) }));
}
