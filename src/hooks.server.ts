import { auth } from '$lib/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import config from './config';
import { POOL, withOrgTransaction } from '$lib/server/database';

export async function handle({ event, resolve }) {
	const session = await auth.api.getSession({
		headers: event.request.headers
	});

	event.locals.config = Object.freeze(config);

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	// Resolve org from /o/[org_slug]/... URLs.
	// Validates that the current user is a member and loads their role + permissions.
	const orgRouteMatch = event.url.pathname.match(/^\/o\/([^/]+)(\/|$)/);
	if (orgRouteMatch && session?.user) {
		const slug = orgRouteMatch[1];

		// Resolve org ID from auth schema (not RLS-protected).
		const orgRow = await POOL.query(
			`SELECT id, name, slug FROM auth.organization WHERE slug = $1`,
			[slug]
		);

		if (orgRow.rows.length > 0) {
			const org = orgRow.rows[0];

			// Load role + permissions inside an org-scoped transaction so RLS
			// on org_role and org_user_role allows the lookup.
			const roleResult = await withOrgTransaction(org.id, async (client) => {
				return client.query(
					`SELECT
						r.id AS role_id,
						r.name AS role_name,
						r.is_owner,
						COALESCE(
							array_agg(rp.resource || ':' || rp.action) FILTER (WHERE rp.id IS NOT NULL),
							ARRAY[]::text[]
						) AS permissions
					FROM auth.member m
					LEFT JOIN org_user_role ur ON ur.org_id = $1 AND ur.user_id = $2
					LEFT JOIN org_role r ON r.id = ur.role_id
					LEFT JOIN org_role_permission rp ON rp.role_id = r.id
					WHERE m.organization_id = $1 AND m.user_id = $2
					GROUP BY r.id, r.name, r.is_owner`,
					[org.id, session.user.id]
				);
			});

			if (roleResult.rows.length > 0) {
				const row = roleResult.rows[0];
				event.locals.organization = {
					id: org.id,
					name: org.name,
					slug: org.slug,
					role: row.role_id
						? {
								id: row.role_id,
								name: row.role_name,
								is_owner: row.is_owner,
								permissions: row.permissions
							}
						: undefined
				};
			}
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
}
