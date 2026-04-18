import { auth } from '$lib/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import config from './config';
import { POOL, withOrgTransaction } from '$lib/server/database';
import { resolveOrgPermissions } from '$lib/server/permissions';



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
	const orgRouteMatch = event.url.pathname.match(/^\/o\/([^/]+)(\/|$)/);
	if (orgRouteMatch && session?.user) {
		const slug = orgRouteMatch[1];

		const orgRow = await POOL.query(
			`SELECT id, name, slug FROM auth.organization WHERE slug = $1`,
			[slug]
		);

		if (orgRow.rows.length > 0) {
			const org = orgRow.rows[0];

			const resolved = await withOrgTransaction(org.id, async (client) => {
				// Confirm the user is actually a member of this org.
				const memberCheck = await client.query(
					`SELECT 1 FROM auth.member WHERE organization_id = $1 AND user_id = $2`,
					[org.id, session.user.id]
				);
				if (memberCheck.rowCount === 0) return null;

				// Primary group: the heaviest (lowest weight) group the user belongs to.
				// Used for display (id + name on the role object).
				const groupResult = await client.query(
					`SELECT pg.id, pg.name
					 FROM user_group_membership ugm
					 JOIN permission_group pg ON pg.id = ugm.group_id
					 WHERE ugm.user_id = $1
					   AND pg.organization_id = $2
					   AND pg.scope = 'organization'
					 ORDER BY pg.weight ASC
					 LIMIT 1`,
					[session.user.id, org.id]
				);

				const permissions = await resolveOrgPermissions(client, session.user.id, org.id);

				return {
					group: groupResult.rows[0] ?? null,
					permissions
				};
			});

			if (resolved !== null) {
				event.locals.organization = {
					id: org.id,
					name: org.name,
					slug: org.slug,
					role: resolved?.group
						? {
								id: resolved.group.id,
								name: resolved.group.name,
							}
						: undefined,
					permissions: resolved.permissions
				};
			}
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
}
