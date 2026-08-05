import { getAuth } from '$lib/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { redirect, error } from '@sveltejs/kit';
import { POOL, withOrgTransaction } from '$lib/server/database';
import { resolveOrgPermissions, resolveInfraPermissions } from '$lib/server/permissions';
import { getSettings } from '$lib/server/services/settings.service';
import { logger } from '$lib/server/logger';

export function handleError({ error: err, event, status, message }) {
	logger.error({ err, status, method: event.request.method, path: event.url.pathname }, 'Unhandled error');
	return { message: status === 500 ? 'Internal server error' : message };
}

export async function handle({ event, resolve }) {
	
	const { pathname } = event.url;
	const isSetupRoute = pathname.startsWith('/setup');
	const isAuthRoute = pathname.startsWith('/auth');

	const auth = await getAuth();

	/* ----- SETTINGS ----- */
	if(building === false) {
		let settings = null;
		try {
			settings = await getSettings();
			event.locals.settings = settings;
		} catch(e) {
			logger.error(e);
		}
	
		if (isSetupRoute === false && (settings === null || settings.setupComplete === false)) {
			logger.warn("the application setupComplete setting is false or non-existant. redirecting user to the setup page.")
			throw redirect(303, '/setup');
		}

		if(isSetupRoute === true && (settings !== null && settings.setupComplete === true)) {
			throw error(404);
		}
	}

	if (isSetupRoute === true) {
		return resolve(event);
	}

	logger.info(event.locals.settings);
	/* ----- END OF SETTINGS ----- */

	let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
	try {
		session = await auth.api.getSession({
			headers: event.request.headers
		});
	} catch {
		logger.error("failed to get session. do auth tables exist?");
	}

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;

		const infraPermissions = await resolveInfraPermissions(session.user.id);
		event.locals.infrastructure = { permissions: infraPermissions };
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
				const memberCheck = await client.query(
					`SELECT 1 FROM auth.member WHERE organization_id = $1 AND user_id = $2`,
					[org.id, session.user.id]
				);
				if (memberCheck.rowCount === 0) return null;

				const roleResult = await client.query(
					`SELECT pr.id, pr.name
					 FROM user_role_membership urm
					 JOIN permission_role pr ON pr.id = urm.role_id
					 WHERE urm.user_id = $1
					   AND pr.organization_id = $2
					   AND pr.scope = 'organization'
					 ORDER BY pr.weight ASC
					 LIMIT 1`,
					[session.user.id, org.id]
				);

				const permissions = await resolveOrgPermissions(client, session.user.id, org.id);

				return {
					role: roleResult.rows[0] ?? null,
					permissions
				};
			});

			if (resolved !== null) {
				event.locals.organization = {
					id: org.id,
					name: org.name,
					slug: org.slug,
					role: resolved?.role
						? {
								id: resolved.role.id,
								name: resolved.role.name,
							}
						: undefined,
					permissions: resolved.permissions
				};
			}
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
}
