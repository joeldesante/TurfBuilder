import type { PoolClient } from 'pg';
import { POOL, withOrgTransaction } from '$lib/server/database';
import { activityEventLabel, type ActivityEventType } from '$lib/shared/registries/activity-events';
import { clampPage, pageOffset, type Page } from '$lib/shared/utils/pagination';
import type { ActivityEntry } from '$lib/shared/types/activity';

export interface RecordEventInput {
	userId?: string | null;
	orgId?: string | null;
	metadata?: Record<string, unknown>;
	/**
	 * Identifies the row the event came from, such as `session:<id>`. The
	 * backfill builds the same keys, so an event recorded live is never added a
	 * second time by a later backfill.
	 */
	sourceKey?: string;
	occurredAt?: Date;
}

/**
 * Records one platform activity event. Runs on its own connection after the
 * change it describes has been made, and never throws: a lost event must not
 * fail the request that caused it.
 */
export async function recordEvent(type: ActivityEventType, input: RecordEventInput = {}): Promise<void> {
	try {
		await POOL.query(
			`INSERT INTO activity_event (type, user_id, org_id, metadata, source_key, occurred_at)
			 VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()))
			 ON CONFLICT (source_key) DO NOTHING`,
			[
				type,
				input.userId ?? null,
				input.orgId ?? null,
				JSON.stringify(input.metadata ?? {}),
				input.sourceKey ?? null,
				input.occurredAt ?? null
			]
		);
	} catch (e) {
		console.error(`[activity] Could not record ${type}:`, e);
	}
}

/** Keys of user_activity_day rows already written by this process today. */
let touchedDay = '';
const touched = new Set<string>();

/**
 * Marks the user active today, platform-wide and in the org when one is given.
 * Called on every signed-in request, so it remembers what it has written and
 * costs at most one insert per user and org per day per process.
 */
export function touchActiveDay(userId: string, orgId?: string | null): void {
	const day = new Date().toISOString().slice(0, 10);
	if (day !== touchedDay) {
		touchedDay = day;
		touched.clear();
	}

	const keys = orgId ? ['', orgId] : [''];
	const fresh = keys.filter((key) => !touched.has(`${userId}|${key}`));
	if (fresh.length === 0) return;
	for (const key of fresh) touched.add(`${userId}|${key}`);

	POOL.query(
		`INSERT INTO user_activity_day (day, user_id, org_key)
		 SELECT $1::date, $2, unnest($3::text[])
		 ON CONFLICT DO NOTHING`,
		[day, userId, fresh]
	).catch((e) => {
		for (const key of fresh) touched.delete(`${userId}|${key}`);
		console.error('[activity] Could not mark the user active:', e);
	});
}

export interface BackfillReport {
	/** Events inserted by this run, by type. Zero for a rerun. */
	inserted: Partial<Record<ActivityEventType, number>>;
	activeDays: number;
}

/**
 * Fills activity_event and user_activity_day from the timestamps the database
 * already holds, so the charts have history from before events were recorded.
 * Safe to rerun: every row carries the source_key a live event would.
 */
export async function backfillActivity(): Promise<BackfillReport> {
	const inserted: BackfillReport['inserted'] = {};

	async function run(
		type: ActivityEventType,
		sql: string,
		params: unknown[] = [],
		db: PoolClient | typeof POOL = POOL
	) {
		const result = await db.query(
			`INSERT INTO activity_event (type, user_id, org_id, metadata, source_key, occurred_at)
			 ${sql}
			 ON CONFLICT (source_key) DO NOTHING`,
			params
		);
		inserted[type] = (inserted[type] ?? 0) + (result.rowCount ?? 0);
	}

	await run(
		'user.signed_up',
		`SELECT 'user.signed_up', id, NULL, '{}'::jsonb, 'user.signed_up:' || id, created_at FROM auth.user`
	);
	await run(
		'user.signed_in',
		`SELECT 'user.signed_in', user_id, active_organization_id, '{}'::jsonb, 'session:' || id, created_at
		 FROM auth.session WHERE impersonated_by IS NULL`
	);
	await run(
		'org.created',
		`SELECT 'org.created', NULL, id, '{}'::jsonb, 'org.created:' || id, created_at FROM auth.organization`
	);
	await run(
		'member.joined',
		`SELECT 'member.joined', user_id, organization_id, '{}'::jsonb, 'member.joined:' || id, created_at FROM auth.member`
	);

	const days = await POOL.query(
		`INSERT INTO user_activity_day (day, user_id, org_key)
		 SELECT DISTINCT created_at::date, user_id, '' FROM auth.session
		 UNION
		 SELECT DISTINCT created_at::date, user_id, active_organization_id::text
		 FROM auth.session WHERE active_organization_id IS NOT NULL
		 ON CONFLICT DO NOTHING`
	);
	let activeDays = days.rowCount ?? 0;

	// Canvassing rows are behind org RLS, so they are copied one org at a time,
	// inside that org's transaction, without leaving the database.
	const orgs = await POOL.query<{ id: string }>(`SELECT id FROM auth.organization`);
	for (const { id: orgId } of orgs.rows) {
		await withOrgTransaction(orgId, async (client) => {
			await run(
				'canvass.visit',
				`SELECT 'canvass.visit', a.user_id, a.org_id,
				        jsonb_build_object('contact_made', COALESCE(a.contact_made, false)),
				        'canvass.visit:' || a.id, a.created_at
				 FROM universe.turf_location_attempt a
				 WHERE a.org_id = $1`,
				[orgId],
				client
			);
			await run(
				'survey.submitted',
				`SELECT 'survey.submitted', a.user_id, a.org_id, '{}'::jsonb,
				        'survey.submitted:' || a.id, a.created_at
				 FROM universe.turf_location_attempt a
				 WHERE a.org_id = $1
				   AND EXISTS (SELECT 1 FROM universe.survey_question_response r
				               WHERE r.turf_location_attempt_id = a.id AND r.org_id = $1)`,
				[orgId],
				client
			);

			const visitDays = await client.query(
				`INSERT INTO user_activity_day (day, user_id, org_key)
				 SELECT DISTINCT a.created_at::date, a.user_id, k.key
				 FROM universe.turf_location_attempt a
				 CROSS JOIN (VALUES (''), ($2::text)) AS k(key)
				 WHERE a.org_id = $1
				 ON CONFLICT DO NOTHING`,
				[orgId, orgId]
			);
			activeDays += visitDays.rowCount ?? 0;
		});
	}

	return { inserted, activeDays };
}

/**
 * One page of the activity feed for a user or an org, newest first. No access
 * check; the infra services that call it have made one.
 */
export async function queryActivityPage(
	scope: { userId?: string; orgId?: string },
	requested: number,
	pageSize = 25
): Promise<Page<ActivityEntry>> {
	const clauses: string[] = [];
	const params: unknown[] = [];
	if (scope.userId) {
		params.push(scope.userId);
		clauses.push(`e.user_id = $${params.length}`);
	}
	if (scope.orgId) {
		params.push(scope.orgId);
		clauses.push(`e.org_id = $${params.length}`);
	}
	const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

	const count = await POOL.query<{ count: string }>(`SELECT COUNT(*) AS count FROM activity_event e ${where}`, params);
	const totalCount = Number(count.rows[0]?.count ?? 0);
	const page = clampPage(requested, totalCount, pageSize);

	const result = await POOL.query<{
		id: string;
		type: string;
		user_id: string | null;
		user_name: string | null;
		org_id: string | null;
		org_name: string | null;
		metadata: Record<string, unknown>;
		occurred_at: Date;
	}>(
		`SELECT e.id, e.type, e.user_id, u.name AS user_name, e.org_id, o.name AS org_name, e.metadata, e.occurred_at
		 FROM activity_event e
		 LEFT JOIN auth.user u ON u.id = e.user_id
		 LEFT JOIN auth.organization o ON o.id = e.org_id
		 ${where}
		 ORDER BY e.occurred_at DESC, e.id DESC
		 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
		[...params, pageSize, pageOffset(page, pageSize)]
	);

	return {
		items: result.rows.map((r) => ({
			id: String(r.id),
			type: r.type,
			label: activityEventLabel(r.type),
			userId: r.user_id,
			userName: r.user_name,
			orgId: r.org_id,
			orgName: r.org_name,
			metadata: r.metadata ?? {},
			occurredAt: r.occurred_at.toISOString()
		})),
		totalCount,
		page,
		pageSize
	};
}

/**
 * Removes activity events and email log rows older than the retention setting
 * (`activity.retention_days`, 0 keeps everything). Returns how many events
 * were removed.
 */
export async function pruneActivity(): Promise<number> {
	const setting = await POOL.query<{ value: string }>(
		`SELECT value FROM system_setting WHERE key = 'activity.retention_days'`
	);
	const days = Number(setting.rows[0]?.value ?? 0);
	if (!Number.isFinite(days) || days <= 0) return 0;

	const result = await POOL.query(
		`DELETE FROM activity_event WHERE occurred_at < now() - make_interval(days => $1)`,
		[days]
	);
	await POOL.query(`DELETE FROM email_log WHERE created_at < now() - make_interval(days => $1)`, [days]);
	return result.rowCount ?? 0;
}
