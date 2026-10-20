import { getRequestEvent } from '$app/server';
import { POOL } from '$lib/server/database';
import { requireInfraPermission } from '$lib/server/permissions';
import { clampPage, pageOffset, PAGE_SIZE, type Page } from '$lib/shared/utils/pagination';
import type { AuditEntry, AuditFilters, AuditTarget } from '$lib/shared/types/audit';

/** The caller's IP and user agent, when called while handling a request. */
function requestMeta(): { ip: string | null; userAgent: string | null } {
	try {
		const event = getRequestEvent();
		let ip: string | null = null;
		try {
			ip = event.getClientAddress();
		} catch {
			ip = null;
		}
		return { ip, userAgent: event.request.headers.get('user-agent') };
	} catch {
		return { ip: null, userAgent: null };
	}
}

/**
 * Records a change an infra admin made. Called by infra services after the
 * change succeeds. Unlike activity events this one throws on failure, so a
 * change is never reported as done without a record of it.
 */
export async function audit(
	actorId: string,
	action: string,
	target: AuditTarget,
	metadata: Record<string, unknown> = {}
): Promise<void> {
	const { ip, userAgent } = requestMeta();
	await POOL.query(
		`INSERT INTO infra_audit_log (actor_id, action, target_type, target_id, metadata, ip, user_agent)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		[actorId, action, target.type, target.id ?? null, JSON.stringify(metadata), ip, userAgent]
	);
}

function whereClause(filters: AuditFilters) {
	const clauses: string[] = [];
	const params: unknown[] = [];
	const add = (sql: string, value: unknown) => {
		params.push(value);
		clauses.push(sql.replace('?', `$${params.length}`));
	};

	if (filters.actorId) add('l.actor_id = ?', filters.actorId);
	if (filters.action) add('l.action = ?', filters.action);
	if (filters.targetType) add('l.target_type = ?', filters.targetType);
	if (filters.targetId) add('l.target_id = ?', filters.targetId);
	if (filters.from) add('l.created_at >= ?::date', filters.from);
	if (filters.to) add(`l.created_at < ?::date + interval '1 day'`, filters.to);

	return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

interface AuditRow {
	id: string;
	actor_id: string | null;
	actor_name: string | null;
	actor_email: string | null;
	action: string;
	target_type: AuditEntry['targetType'];
	target_id: string | null;
	metadata: Record<string, unknown>;
	ip: string | null;
	user_agent: string | null;
	created_at: Date;
}

function toEntry(row: AuditRow): AuditEntry {
	return {
		id: String(row.id),
		actorId: row.actor_id,
		actorName: row.actor_name,
		actorEmail: row.actor_email,
		action: row.action,
		targetType: row.target_type,
		targetId: row.target_id,
		metadata: row.metadata ?? {},
		ip: row.ip,
		userAgent: row.user_agent,
		createdAt: row.created_at.toISOString()
	};
}

/** One page of the audit log, newest first. No access check; callers have made one. */
export async function queryAuditPage(
	filters: AuditFilters,
	requested: number,
	pageSize = PAGE_SIZE
): Promise<Page<AuditEntry>> {
	const where = whereClause(filters);

	const count = await POOL.query<{ count: string }>(
		`SELECT COUNT(*) AS count FROM infra_audit_log l ${where.sql}`,
		where.params
	);
	const totalCount = Number(count.rows[0]?.count ?? 0);
	const page = clampPage(requested, totalCount, pageSize);

	const result = await POOL.query<AuditRow>(
		`SELECT l.id, l.actor_id, u.name AS actor_name, u.email AS actor_email, l.action,
		        l.target_type, l.target_id, l.metadata, l.ip, l.user_agent, l.created_at
		 FROM infra_audit_log l
		 LEFT JOIN auth.user u ON u.id = l.actor_id
		 ${where.sql}
		 ORDER BY l.created_at DESC, l.id DESC
		 LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`,
		[...where.params, pageSize, pageOffset(page, pageSize)]
	);

	return { items: result.rows.map(toEntry), totalCount, page, pageSize };
}

/** The audit log, for the audit page. 403 without `audit.read`. */
export async function listAuditEvents(
	userId: string,
	filters: AuditFilters,
	page: number
): Promise<Page<AuditEntry>> {
	await requireInfraPermission(userId, 'audit.read');
	return queryAuditPage(filters, page);
}

/** Changes made to one user or org, for its detail page. 403 without `access`. */
export async function listAuditEventsFor(
	userId: string,
	target: Required<AuditTarget>,
	page: number
): Promise<Page<AuditEntry>> {
	await requireInfraPermission(userId, 'access');
	return queryAuditPage({ targetType: target.type, targetId: target.id ?? undefined }, page, 25);
}
