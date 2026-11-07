import { error } from '@sveltejs/kit';
import { POOL, withOrgTransaction } from '$lib/server/database';
import { resolveOrgPermissions } from '$lib/server/permissions';

/**
 * The organization a request acts in, as the caller sees it: their
 * highest-priority role and resolved permissions. `hooks.server.ts` uses it to
 * set `locals.organization` for /o/{slug} URLs; /api/v1 routes that need the
 * caller's role use it by id. Kept apart from organizations.service so the
 * hook, which runs on every request, loads only what it needs.
 */
/** The caller's view of an organization: what `locals.organization` holds. */
export type RequestOrganization = NonNullable<App.Locals['organization']>;

interface OrgRow {
	id: string;
	name: string;
	slug: string;
	suspended_at: Date | null;
}

/**
 * The caller's highest-priority organization role and resolved permissions,
 * or null when they are not a member.
 */
async function withMembership(userId: string, org: OrgRow): Promise<RequestOrganization | null> {
	const resolved = await withOrgTransaction(org.id, async (client) => {
		const member = await client.query(
			`SELECT 1 FROM auth.member WHERE organization_id = $1 AND user_id = $2`,
			[org.id, userId]
		);
		if (member.rowCount === 0) return null;

		const role = await client.query<{ id: string; name: string }>(
			`SELECT pr.id, pr.name
			 FROM user_role_membership urm
			 JOIN permission_role pr ON pr.id = urm.role_id
			 WHERE urm.user_id = $1
			   AND pr.organization_id = $2
			   AND pr.scope = 'organization'
			 ORDER BY pr.weight ASC
			 LIMIT 1`,
			[userId, org.id]
		);

		return {
			role: role.rows[0],
			permissions: await resolveOrgPermissions(client, userId, org.id)
		};
	});
	if (!resolved) return null;

	return {
		id: org.id,
		name: org.name,
		slug: org.slug,
		role: resolved.role ? { id: resolved.role.id, name: resolved.role.name } : undefined,
		permissions: resolved.permissions
	};
}

/**
 * The organization at `/o/{slug}` for `hooks.server.ts`, or null when there is
 * none by that slug (a deleted one counts as none) or the caller is not a
 * member. 403 for a suspended one, unless `infraAccess` lets an infra admin in.
 */
export async function resolveRequestOrganization(
	userId: string,
	slug: string,
	{ infraAccess }: { infraAccess: boolean }
): Promise<RequestOrganization | null> {
	const found = await POOL.query<OrgRow>(
		`SELECT id, name, slug, suspended_at FROM auth.organization WHERE slug = $1 AND deleted_at IS NULL`,
		[slug]
	);
	const org = found.rows[0];
	if (!org) return null;

	if (org.suspended_at && !infraAccess) {
		throw error(403, 'This organization has been suspended. Contact support for help.');
	}

	return withMembership(userId, org);
}

/**
 * `resolveRequestOrganization` by id, for /api/v1 routes that need the
 * caller's role. 404 unless the caller is a member of a live organization,
 * 403 when it is suspended.
 */
export async function requireRequestOrganization(
	userId: string,
	orgId: string
): Promise<RequestOrganization> {
	const found = await POOL.query<OrgRow>(
		`SELECT id, name, slug, suspended_at FROM auth.organization WHERE id = $1 AND deleted_at IS NULL`,
		[orgId]
	);
	const org = found.rows[0];
	if (!org) throw error(404, 'Organization not found');
	if (org.suspended_at) throw error(403, 'This organization has been suspended.');

	const resolved = await withMembership(userId, org);
	if (!resolved) throw error(404, 'Organization not found');
	return resolved;
}
