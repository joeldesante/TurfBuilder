import { error } from '@sveltejs/kit';
import { getAuth } from '$lib/auth';
import { POOL, withOrgTransaction } from '$lib/server/database';
import { canInfra, requireInfraPermission } from '$lib/server/permissions';
import { isMailConfigured } from '$lib/server/mail';
import { audit, listAuditEventsFor } from './audit.service';
import { queryActivityPage } from './activity.service';
import { queryEmailLogPage } from './email-log.service';
import { requireNotLastAdmin } from './infra-admins.service';
import { clampPage, pageOffset, PAGE_SIZE, type Page } from '$lib/shared/utils/pagination';
import type {
	PlatformUserDetail,
	PlatformUserRow,
	UserFilters,
	UserMembership,
	UserSession
} from '$lib/shared/types/platform-users';
import type { UpdateUserInput, SuspendUserInput } from '$lib/shared/schemas/platform-users';
import type { ActivityEntry, EmailLogEntry } from '$lib/shared/types/activity';
import type { AuditEntry } from '$lib/shared/types/audit';

const UNIQUE_VIOLATION = '23505';

/** Suspended now: banned with no end, or an end still ahead. */
const SUSPENDED = `(u.banned IS TRUE AND (u.ban_expires IS NULL OR u.ban_expires > now()))`;

/** Holds an infrastructure role or a direct infrastructure grant. */
const INFRA_ADMIN = `(
	EXISTS (SELECT 1 FROM user_role_membership urm
	        JOIN permission_role pr ON pr.id = urm.role_id
	        WHERE urm.user_id = u.id AND pr.scope = 'infrastructure')
	OR EXISTS (SELECT 1 FROM user_permission up
	           JOIN registered_permission rp ON rp.id = up.registered_permission_id
	           WHERE up.user_id = u.id AND up.organization_id IS NULL
	             AND rp.scope = 'infrastructure' AND up.value)
)`;

const LAST_ACTIVE = `(SELECT max(d.day) FROM user_activity_day d WHERE d.user_id = u.id AND d.org_key = '')`;

const ROW_COLUMNS = `
	u.id, u.name, u.email, u.username, u.image, u.email_verified,
	COALESCE(u.two_factor_enabled, false) AS two_factor_enabled,
	${SUSPENDED} AS suspended, u.created_at,
	${LAST_ACTIVE} AS last_active_day,
	(SELECT COUNT(*) FROM auth.member m WHERE m.user_id = u.id) AS org_count,
	${INFRA_ADMIN} AS is_infra_admin`;

interface UserRowRecord {
	id: string;
	name: string;
	email: string;
	username: string;
	image: string | null;
	email_verified: boolean;
	two_factor_enabled: boolean;
	suspended: boolean;
	created_at: Date;
	last_active_day: string | Date | null;
	org_count: string;
	is_infra_admin: boolean;
}

function day(value: string | Date | null): string | null {
	if (!value) return null;
	return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function toRow(r: UserRowRecord): PlatformUserRow {
	return {
		id: r.id,
		name: r.name,
		email: r.email,
		username: r.username,
		image: r.image,
		emailVerified: r.email_verified,
		twoFactorEnabled: r.two_factor_enabled,
		suspended: r.suspended,
		createdAt: r.created_at.toISOString(),
		lastActiveDay: day(r.last_active_day),
		orgCount: Number(r.org_count),
		isInfraAdmin: r.is_infra_admin
	};
}

/** `%term%` for LIKE, with LIKE's own wildcards escaped. */
function likePattern(term: string): string {
	return `%${term.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function filterSql(filters: UserFilters) {
	const clauses = ['u.deleted_at IS NULL'];
	const params: unknown[] = [];

	if (filters.q) {
		params.push(likePattern(filters.q));
		const p = `$${params.length}`;
		clauses.push(`(lower(u.email) LIKE ${p} OR lower(u.name) LIKE ${p} OR lower(u.username) LIKE ${p})`);
	}

	switch (filters.status) {
		case 'unverified':
			clauses.push('u.email_verified IS NOT TRUE');
			break;
		case 'suspended':
			clauses.push(SUSPENDED);
			break;
		case 'two_factor':
			clauses.push('u.two_factor_enabled IS TRUE');
			break;
		case 'infra_admin':
			clauses.push(INFRA_ADMIN);
			break;
		case 'no_orgs':
			clauses.push('NOT EXISTS (SELECT 1 FROM auth.member m WHERE m.user_id = u.id)');
			break;
		case 'never_active':
			clauses.push('NOT EXISTS (SELECT 1 FROM user_activity_day d WHERE d.user_id = u.id)');
			break;
	}

	return { where: `WHERE ${clauses.join(' AND ')}`, params };
}

const ORDER: Record<NonNullable<UserFilters['sort']>, string> = {
	newest: 'u.created_at DESC, u.id',
	oldest: 'u.created_at ASC, u.id',
	recently_active: 'last_active_day DESC NULLS LAST, u.created_at DESC, u.id',
	name: 'lower(u.name), u.id'
};

/** One page of users. No access check; callers have made one. */
export async function queryUsersPage(
	filters: UserFilters,
	requested: number,
	pageSize = PAGE_SIZE
): Promise<Page<PlatformUserRow>> {
	const { where, params } = filterSql(filters);

	const count = await POOL.query<{ count: string }>(`SELECT COUNT(*) AS count FROM auth.user u ${where}`, params);
	const totalCount = Number(count.rows[0]?.count ?? 0);
	const page = clampPage(requested, totalCount, pageSize);

	const result = await POOL.query<UserRowRecord>(
		`SELECT ${ROW_COLUMNS}
		 FROM auth.user u
		 ${where}
		 ORDER BY ${ORDER[filters.sort ?? 'newest']}
		 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
		[...params, pageSize, pageOffset(page, pageSize)]
	);

	return { items: result.rows.map(toRow), totalCount, page, pageSize };
}

/** The users list. 403 without `access`. */
export async function listUsers(userId: string, filters: UserFilters, page: number): Promise<Page<PlatformUserRow>> {
	await requireInfraPermission(userId, 'access');
	return queryUsersPage(filters, page);
}

/** The user, or 404. Deleted (anonymized) users are still found, so their page explains it. */
async function findUser(targetId: string): Promise<PlatformUserDetail> {
	const result = await POOL.query<
		UserRowRecord & {
			display_username: string;
			updated_at: Date;
			ban_reason: string | null;
			ban_expires: Date | null;
			deleted_at: Date | null;
			sign_in_methods: { providerId: string; createdAt: string }[] | null;
			infra_roles: { id: string; name: string }[] | null;
			active_sessions: string;
		}
	>(
		`SELECT ${ROW_COLUMNS},
		        u.display_username, u.updated_at, u.ban_reason, u.ban_expires, u.deleted_at,
		        (SELECT json_agg(json_build_object('providerId', a.provider_id, 'createdAt', a.created_at) ORDER BY a.created_at)
		         FROM auth.account a WHERE a.user_id = u.id) AS sign_in_methods,
		        (SELECT json_agg(json_build_object('id', pr.id, 'name', pr.name) ORDER BY pr.weight)
		         FROM user_role_membership urm
		         JOIN permission_role pr ON pr.id = urm.role_id AND pr.scope = 'infrastructure'
		         WHERE urm.user_id = u.id) AS infra_roles,
		        (SELECT COUNT(*) FROM auth.session s WHERE s.user_id = u.id AND s.expires_at > now()) AS active_sessions
		 FROM auth.user u
		 WHERE u.id = $1`,
		[targetId]
	);
	const r = result.rows[0];
	if (!r) throw error(404, 'User not found.');

	return {
		...toRow(r),
		displayUsername: r.display_username,
		updatedAt: r.updated_at.toISOString(),
		suspendedReason: r.suspended ? r.ban_reason : null,
		suspendedUntil: r.suspended && r.ban_expires ? r.ban_expires.toISOString() : null,
		signInMethods: r.sign_in_methods ?? [],
		infraRoles: r.infra_roles ?? [],
		activeSessionCount: Number(r.active_sessions),
		deleted: r.deleted_at !== null
	};
}

/** One user's detail page. 403 without `access`, 404 for an unknown user. */
export async function getUser(userId: string, targetId: string): Promise<PlatformUserDetail> {
	await requireInfraPermission(userId, 'access');
	return findUser(targetId);
}

/**
 * The orgs the user belongs to. Role names live behind org RLS, so they are
 * read inside each org; a user belongs to a handful of orgs at most.
 */
export async function listUserMemberships(userId: string, targetId: string): Promise<UserMembership[]> {
	await requireInfraPermission(userId, 'access');

	const result = await POOL.query<{
		member_id: string;
		organization_id: string;
		name: string;
		slug: string;
		role: string;
		created_at: Date;
		last_active_day: string | Date | null;
		suspended_at: Date | null;
		deleted_at: Date | null;
	}>(
		`SELECT m.id AS member_id, o.id AS organization_id, o.name, o.slug, m.role, m.created_at,
		        (SELECT max(d.day) FROM user_activity_day d WHERE d.user_id = m.user_id AND d.org_key = o.id::text) AS last_active_day,
		        o.suspended_at, o.deleted_at
		 FROM auth.member m
		 JOIN auth.organization o ON o.id = m.organization_id
		 WHERE m.user_id = $1
		 ORDER BY o.name`,
		[targetId]
	);

	return Promise.all(
		result.rows.map(async (r) => {
			const roleName = await withOrgTransaction(r.organization_id, async (client) => {
				const role = await client.query<{ name: string }>(
					`SELECT pr.name FROM user_role_membership urm
					 JOIN permission_role pr ON pr.id = urm.role_id
					 WHERE urm.member_id = $1 AND pr.organization_id = $2 AND pr.is_default = false
					 ORDER BY pr.weight LIMIT 1`,
					[r.member_id, r.organization_id]
				);
				return role.rows[0]?.name ?? null;
			});
			return {
				memberId: r.member_id,
				organizationId: r.organization_id,
				name: r.name,
				slug: r.slug,
				memberRole: r.role,
				roleName,
				joinedAt: r.created_at.toISOString(),
				lastActiveDay: day(r.last_active_day),
				suspended: r.suspended_at !== null,
				deleted: r.deleted_at !== null
			};
		})
	);
}

/** The user's sessions that have not expired, newest first. 403 without `access`. */
export async function listUserSessions(userId: string, targetId: string): Promise<UserSession[]> {
	await requireInfraPermission(userId, 'access');
	await findUser(targetId);

	const result = await POOL.query<{
		id: string;
		ip_address: string | null;
		user_agent: string | null;
		created_at: Date;
		updated_at: Date;
		expires_at: Date;
		impersonated_by: string | null;
		impersonator_name: string | null;
	}>(
		`SELECT s.id, s.ip_address, s.user_agent, s.created_at, s.updated_at, s.expires_at,
		        s.impersonated_by, i.name AS impersonator_name
		 FROM auth.session s
		 LEFT JOIN auth.user i ON i.id = s.impersonated_by
		 WHERE s.user_id = $1 AND s.expires_at > now()
		 ORDER BY s.updated_at DESC`,
		[targetId]
	);

	return result.rows.map((r) => ({
		id: r.id,
		ipAddress: r.ip_address,
		userAgent: r.user_agent,
		createdAt: r.created_at.toISOString(),
		updatedAt: r.updated_at.toISOString(),
		expiresAt: r.expires_at.toISOString(),
		impersonatedBy: r.impersonated_by ? { id: r.impersonated_by, name: r.impersonator_name ?? 'Unknown' } : null
	}));
}

export async function listUserActivity(userId: string, targetId: string, page: number): Promise<Page<ActivityEntry>> {
	await requireInfraPermission(userId, 'access');
	return queryActivityPage({ userId: targetId }, page);
}

export async function listUserEmails(userId: string, targetId: string, page: number): Promise<Page<EmailLogEntry>> {
	await requireInfraPermission(userId, 'access');
	const user = await findUser(targetId);
	return queryEmailLogPage({ recipient: user.email }, page, 25);
}

export async function listUserAudit(userId: string, targetId: string, page: number): Promise<Page<AuditEntry>> {
	return listAuditEventsFor(userId, { type: 'user', id: targetId }, page);
}

/** Loads the target for a change: 404 when missing, 409 when it was deleted. */
async function findChangeable(targetId: string): Promise<PlatformUserDetail> {
	const user = await findUser(targetId);
	if (user.deleted) throw error(409, 'This account was deleted.');
	return user;
}

/** Signs the user out of every session, or every session but `keepSessionId`. Returns how many ended. */
export async function revokeUserSessions(userId: string, targetId: string, keepSessionId?: string): Promise<number> {
	await requireInfraPermission(userId, 'users.manage');
	await findUser(targetId);

	const result = await POOL.query(
		`DELETE FROM auth.session WHERE user_id = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)`,
		[targetId, keepSessionId ?? null]
	);
	await audit(userId, 'user.sessions.revoke', { type: 'user', id: targetId }, { count: result.rowCount ?? 0 });
	return result.rowCount ?? 0;
}

/** Ends one session. 404 for an unknown session. */
export async function revokeSession(userId: string, sessionId: string): Promise<void> {
	await requireInfraPermission(userId, 'users.manage');

	const result = await POOL.query<{ user_id: string }>(`DELETE FROM auth.session WHERE id = $1 RETURNING user_id`, [
		sessionId
	]);
	if (!result.rowCount) throw error(404, 'Session not found.');
	await audit(userId, 'user.session.revoke', { type: 'user', id: result.rows[0].user_id }, { sessionId });
}

/**
 * Edits the user's name, email, username, or verified flag. A new email is
 * unverified unless `emailVerified` says otherwise. 409 when the email or
 * username is taken.
 */
export async function updateUser(userId: string, targetId: string, input: UpdateUserInput): Promise<PlatformUserDetail> {
	await requireInfraPermission(userId, 'users.manage');
	const before = await findChangeable(targetId);

	const sets: string[] = [];
	const params: unknown[] = [];
	const changes: Record<string, { from: unknown; to: unknown }> = {};
	const set = (column: string, value: unknown, label: string, from: unknown) => {
		params.push(value);
		sets.push(`${column} = $${params.length}`);
		changes[label] = { from, to: value };
	};

	if (input.name !== undefined && input.name !== before.name) set('name', input.name, 'name', before.name);
	if (input.email !== undefined && input.email !== before.email) {
		set('email', input.email, 'email', before.email);
		if (input.emailVerified === undefined) set('email_verified', false, 'emailVerified', before.emailVerified);
	}
	if (input.username !== undefined && input.username.toLowerCase() !== before.username) {
		set('username', input.username.toLowerCase(), 'username', before.username);
		params.push(input.username);
		sets.push(`display_username = $${params.length}`);
	}
	if (input.emailVerified !== undefined && input.emailVerified !== before.emailVerified) {
		set('email_verified', input.emailVerified, 'emailVerified', before.emailVerified);
	}

	if (sets.length === 0) return before;

	try {
		params.push(targetId);
		await POOL.query(`UPDATE auth.user SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);
	} catch (e) {
		if ((e as { code?: string }).code === UNIQUE_VIOLATION) {
			const constraint = (e as { constraint?: string }).constraint ?? '';
			throw error(409, constraint.includes('email') ? 'Another account uses that email.' : 'Another account uses that username.');
		}
		throw e;
	}

	await audit(userId, 'user.update', { type: 'user', id: targetId }, { changes });
	return findUser(targetId);
}

async function requireMail(): Promise<void> {
	if (!(await isMailConfigured())) {
		throw error(409, 'Outgoing mail is not set up. Configure it under Settings, Email.');
	}
}

/** Emails the user a password reset link through the normal reset flow. */
export async function sendPasswordReset(userId: string, targetId: string): Promise<void> {
	await requireInfraPermission(userId, 'users.manage');
	const user = await findChangeable(targetId);
	await requireMail();

	const auth = await getAuth();
	await auth.api.requestPasswordReset({ body: { email: user.email, redirectTo: '/auth/reset-password' } });
	await audit(userId, 'user.password_reset.send', { type: 'user', id: targetId }, { email: user.email });
}

/** Emails the user a new verification link. 409 when already verified. */
export async function sendVerificationEmail(userId: string, targetId: string): Promise<void> {
	await requireInfraPermission(userId, 'users.manage');
	const user = await findChangeable(targetId);
	if (user.emailVerified) throw error(409, 'This email is already verified.');
	await requireMail();

	const auth = await getAuth();
	await auth.api.sendVerificationEmail({ body: { email: user.email, callbackURL: '/' } });
	await audit(userId, 'user.verification.send', { type: 'user', id: targetId }, { email: user.email });
}

/** Turns two-factor sign-in off, for someone locked out of their authenticator. */
export async function resetTwoFactor(userId: string, targetId: string): Promise<void> {
	await requireInfraPermission(userId, 'users.manage');
	const user = await findChangeable(targetId);
	if (!user.twoFactorEnabled) throw error(409, 'Two-factor sign-in is not on for this user.');

	const client = await POOL.connect();
	try {
		await client.query('BEGIN');
		await client.query(`UPDATE auth.user SET two_factor_enabled = false, updated_at = now() WHERE id = $1`, [targetId]);
		await client.query(`DELETE FROM auth.two_factor WHERE user_id = $1`, [targetId]);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
	await audit(userId, 'user.two_factor.reset', { type: 'user', id: targetId });
}

/**
 * Suspends the user: they cannot sign in until it ends, and every session
 * they have is ended now. Infra admins are not suspended here; remove their
 * roles first.
 */
export async function suspendUser(userId: string, targetId: string, input: SuspendUserInput): Promise<PlatformUserDetail> {
	await requireInfraPermission(userId, 'users.manage');
	if (userId === targetId) throw error(400, 'You cannot suspend yourself.');
	await findChangeable(targetId);
	if (await canInfra(targetId, 'access')) {
		throw error(409, 'Infrastructure admins cannot be suspended. Remove their infrastructure roles first.');
	}

	const client = await POOL.connect();
	try {
		await client.query('BEGIN');
		await client.query(
			`UPDATE auth.user SET banned = true, ban_reason = $2, ban_expires = $3, updated_at = now() WHERE id = $1`,
			[targetId, input.reason, input.expiresAt ? new Date(input.expiresAt) : null]
		);
		await client.query(`DELETE FROM auth.session WHERE user_id = $1`, [targetId]);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}

	await audit(userId, 'user.suspend', { type: 'user', id: targetId }, {
		reason: input.reason,
		expiresAt: input.expiresAt ?? null
	});
	return findUser(targetId);
}

/** Lifts a suspension. */
export async function unsuspendUser(userId: string, targetId: string): Promise<PlatformUserDetail> {
	await requireInfraPermission(userId, 'users.manage');
	const user = await findChangeable(targetId);
	if (!user.suspended) throw error(409, 'This user is not suspended.');

	await POOL.query(
		`UPDATE auth.user SET banned = false, ban_reason = NULL, ban_expires = NULL, updated_at = now() WHERE id = $1`,
		[targetId]
	);
	await audit(userId, 'user.unsuspend', { type: 'user', id: targetId });
	return findUser(targetId);
}

/** Orgs where the user is the only owner, which deleting them would leave without one. */
async function soleOwnedOrgs(targetId: string): Promise<{ id: string; name: string }[]> {
	const isOwner = (alias: string) => `'owner' = ANY(string_to_array(replace(${alias}.role, ' ', ''), ','))`;
	const result = await POOL.query<{ id: string; name: string }>(
		`SELECT o.id, o.name
		 FROM auth.member m
		 JOIN auth.organization o ON o.id = m.organization_id AND o.deleted_at IS NULL
		 WHERE m.user_id = $1 AND ${isOwner('m')}
		   AND NOT EXISTS (
		     SELECT 1 FROM auth.member m2
		     WHERE m2.organization_id = m.organization_id AND m2.user_id <> $1 AND ${isOwner('m2')}
		   )
		 ORDER BY o.name`,
		[targetId]
	);
	return result.rows;
}

/**
 * Deletes the account by anonymizing it. The row stays, because turfs and
 * canvass visits reference it and an org's records must not disappear with
 * one person. Their name, email, and username are replaced, every way to sign
 * in is removed, and they leave every org. `confirmEmail` must match the
 * account's email. 409 when they are an org's only owner or the last admin.
 */
export async function deleteUser(userId: string, targetId: string, confirmEmail: string): Promise<void> {
	await requireInfraPermission(userId, 'users.manage');
	if (userId === targetId) throw error(400, 'You cannot delete your own account here.');
	const user = await findChangeable(targetId);
	if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
		throw error(400, 'Type the account email exactly to confirm.');
	}

	const owned = await soleOwnedOrgs(targetId);
	if (owned.length > 0) {
		throw error(
			409,
			`This user is the only owner of ${owned.map((o) => o.name).join(', ')}. Transfer ownership first.`
		);
	}
	if (await canInfra(targetId, 'access')) await requireNotLastAdmin(targetId, 'deleted');

	const tag = targetId.replace(/-/g, '').slice(0, 16);
	const client = await POOL.connect();
	try {
		await client.query('BEGIN');
		await client.query(
			`UPDATE auth.user SET
			   name = 'Deleted user', email = $2, username = $3, display_username = $3, image = NULL,
			   email_verified = false, two_factor_enabled = false,
			   banned = true, ban_reason = 'This account was deleted.', ban_expires = NULL,
			   deleted_at = now(), updated_at = now()
			 WHERE id = $1`,
			[targetId, `deleted-${tag}@deleted.invalid`, `deleted_${tag}`]
		);
		await client.query(`DELETE FROM auth.session WHERE user_id = $1`, [targetId]);
		await client.query(`DELETE FROM auth.account WHERE user_id = $1`, [targetId]);
		await client.query(`DELETE FROM auth.two_factor WHERE user_id = $1`, [targetId]);
		await client.query(`DELETE FROM user_role_membership WHERE user_id = $1 AND member_id IS NULL`, [targetId]);
		await client.query(`DELETE FROM user_permission WHERE user_id = $1 AND organization_id IS NULL`, [targetId]);
		// Org role memberships go with the member rows (ON DELETE CASCADE).
		await client.query(`DELETE FROM auth.member WHERE user_id = $1`, [targetId]);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}

	await audit(userId, 'user.delete', { type: 'user', id: targetId }, { name: user.name, email: user.email });
}
