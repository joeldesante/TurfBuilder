import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { POOL } from '$lib/server/database';

/**
 * better-auth's organization endpoints that do not act on one organization,
 * or that let someone step away from one. These work whatever its status.
 */
const UNSCOPED = new Set([
	'/organization/create',
	'/organization/list',
	'/organization/check-slug',
	'/organization/list-user-invitations',
	'/organization/list-user-teams',
	'/organization/reject-invitation',
	'/organization/leave'
]);

type Status = 'active' | 'suspended' | 'deleted' | 'missing';

interface RequestShape {
	path: string;
	body?: Record<string, unknown> | null;
	query?: Record<string, unknown> | null;
}

function text(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value : null;
}

/**
 * The organization an organization endpoint acts on: the one it names by id,
 * by slug, or through an invitation, else the session's active one. Null when
 * there is none, as when clearing the active org.
 */
export async function organizationStatusFor(
	request: RequestShape,
	activeOrganizationId: string | null
): Promise<Status | null> {
	const input = { ...(request.query ?? {}), ...(request.body ?? {}) };

	const select = `SELECT o.deleted_at IS NOT NULL AS deleted, o.suspended_at IS NOT NULL AS suspended FROM auth.organization o`;
	let result: { rows: { deleted: boolean; suspended: boolean }[] } | null = null;

	const id = text(input.organizationId);
	const slug = text(input.organizationSlug);
	const invitationId = text(input.invitationId);

	if (id) result = await POOL.query(`${select} WHERE o.id::text = $1`, [id]);
	else if (slug) result = await POOL.query(`${select} WHERE o.slug = $1`, [slug]);
	else if (invitationId) {
		result = await POOL.query(`${select} JOIN auth.invitation i ON i.organization_id = o.id WHERE i.id::text = $1`, [
			invitationId
		]);
	} else if (request.path === '/organization/set-active') {
		// Clearing the active org (organizationId: null) acts on nothing.
		return null;
	} else if (activeOrganizationId) {
		result = await POOL.query(`${select} WHERE o.id::text = $1`, [activeOrganizationId]);
	} else {
		return null;
	}

	const row = result.rows[0];
	if (!row) return 'missing';
	if (row.deleted) return 'deleted';
	if (row.suspended) return 'suspended';
	return 'active';
}

/**
 * Stops better-auth's organization endpoints from acting on a suspended or
 * deleted organization, the way hooks.server.ts stops its pages and the
 * /api/v1 services stop their routes. A deleted org answers as not found.
 */
export const organizationStatusGuard = createAuthMiddleware(async (ctx) => {
	if (!ctx.path.startsWith('/organization/') || UNSCOPED.has(ctx.path)) return;

	const session = await getSessionFromCtx(ctx).catch(() => null);
	const active = (session?.session as { activeOrganizationId?: string | null } | undefined)?.activeOrganizationId ?? null;

	const status = await organizationStatusFor(
		{ path: ctx.path, body: ctx.body as Record<string, unknown> | null, query: ctx.query as Record<string, unknown> | null },
		active
	);
	if (status === 'suspended') {
		throw new APIError('FORBIDDEN', { message: 'This organization has been suspended.' });
	}
	if (status === 'deleted') {
		throw new APIError('NOT_FOUND', { message: 'Organization not found.' });
	}
});
