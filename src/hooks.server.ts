import { auth } from '$lib/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import config from './config';
import { POOL } from '$lib/server/database';

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
		const client = await POOL.connect();
		try {
			const result = await client.query(
				`SELECT
					o.id,
					o.name,
					o.slug,
					r.id AS role_id,
					r.name AS role_name,
					r.is_owner,
					COALESCE(
						array_agg(rp.resource || ':' || rp.action) FILTER (WHERE rp.id IS NOT NULL),
						ARRAY[]::text[]
					) AS permissions
				FROM auth.organization o
				JOIN auth.member m ON m.organization_id = o.id AND m.user_id = $2
				LEFT JOIN org_user_role ur ON ur.org_id = o.id AND ur.user_id = $2
				LEFT JOIN org_role r ON r.id = ur.role_id
				LEFT JOIN org_role_permission rp ON rp.role_id = r.id
				WHERE o.slug = $1
				GROUP BY o.id, o.name, o.slug, r.id, r.name, r.is_owner`,
				[slug, session.user.id]
			);

			if (result.rows.length > 0) {
				const row = result.rows[0];
				event.locals.organization = {
					id: row.id,
					name: row.name,
					slug: row.slug,
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
		} finally {
			client.release();
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
}
