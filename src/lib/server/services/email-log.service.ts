import { POOL } from '$lib/server/database';
import { requireInfraPermission } from '$lib/server/permissions';
import { clampPage, pageOffset, PAGE_SIZE, type Page } from '$lib/shared/utils/pagination';
import type { EmailLogEntry, EmailLogFilters } from '$lib/shared/types/activity';

/** One page of the email log, newest first. No access check; callers have made one. */
export async function queryEmailLogPage(
	filters: EmailLogFilters,
	requested: number,
	pageSize = PAGE_SIZE
): Promise<Page<EmailLogEntry>> {
	const clauses: string[] = [];
	const params: unknown[] = [];
	if (filters.status) {
		params.push(filters.status);
		clauses.push(`status = $${params.length}`);
	}
	if (filters.template) {
		params.push(filters.template);
		clauses.push(`template = $${params.length}`);
	}
	if (filters.recipient) {
		params.push(filters.recipient.toLowerCase());
		clauses.push(`lower(recipient) = $${params.length}`);
	}
	const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

	const count = await POOL.query<{ count: string }>(`SELECT COUNT(*) AS count FROM email_log ${where}`, params);
	const totalCount = Number(count.rows[0]?.count ?? 0);
	const page = clampPage(requested, totalCount, pageSize);

	const result = await POOL.query<{
		id: string;
		recipient: string;
		template: string;
		subject: string | null;
		status: EmailLogEntry['status'];
		error: string | null;
		created_at: Date;
	}>(
		`SELECT id, recipient, template, subject, status, error, created_at
		 FROM email_log ${where}
		 ORDER BY created_at DESC, id DESC
		 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
		[...params, pageSize, pageOffset(page, pageSize)]
	);

	return {
		items: result.rows.map((r) => ({
			id: String(r.id),
			recipient: r.recipient,
			template: r.template,
			subject: r.subject,
			status: r.status,
			error: r.error,
			createdAt: r.created_at.toISOString()
		})),
		totalCount,
		page,
		pageSize
	};
}

/** The email log page. 403 without `settings.manage`. */
export async function listEmailLog(
	userId: string,
	filters: EmailLogFilters,
	page: number
): Promise<Page<EmailLogEntry>> {
	await requireInfraPermission(userId, 'settings.manage');
	return queryEmailLogPage(filters, page);
}

/** Templates that appear in the log, for the template filter. */
export async function emailLogTemplates(userId: string): Promise<string[]> {
	await requireInfraPermission(userId, 'settings.manage');
	const result = await POOL.query<{ template: string }>(
		`SELECT key AS template FROM email_template
		 UNION
		 SELECT DISTINCT template FROM email_log WHERE created_at > now() - interval '90 days'
		 ORDER BY template`
	);
	return result.rows.map((r) => r.template);
}

/** How many emails were sent, skipped, and failed in the last `days` days. */
export async function emailLogTotals(days: number): Promise<Record<EmailLogEntry['status'], number>> {
	const result = await POOL.query<{ status: EmailLogEntry['status']; count: string }>(
		`SELECT status, COUNT(*) AS count FROM email_log
		 WHERE created_at > now() - make_interval(days => $1)
		 GROUP BY status`,
		[days]
	);
	const totals = { sent: 0, skipped: 0, failed: 0 };
	for (const row of result.rows) totals[row.status] = Number(row.count);
	return totals;
}
