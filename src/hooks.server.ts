import { getAuth } from '$lib/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { redirect, error, isHttpError, isRedirect, type Handle } from '@sveltejs/kit';
import { POOL, withOrgTransaction } from '$lib/server/database';
import { resolveOrgPermissions, resolveInfraPermissions } from '$lib/server/permissions';
import { isSetupComplete } from '$lib/server/setup';
import { getAllSettings, SettingsMissingError } from '$lib/server/settings';
import { touchActiveDay } from '$lib/server/services/activity.service';
import { audit } from '$lib/server/services/audit.service';
import { logger } from '$lib/server/logger';
import { startRuntimeMetrics } from '$lib/server/runtime-metrics';
import { analytics, configureAnalytics } from '$lib/server/analytics';
import { applyTelemetry } from '$lib/server/telemetry';

if (!building) startRuntimeMetrics();

export function handleError({ error: err, event, status, message }) {
	logger.error(
		{ err, status, method: event.request.method, route: event.route?.id ?? '(unmatched)' },
		'Unhandled request error'
	);
	// Fire and forget; a no-op unless analytics is on. The error is scrubbed first.
	analytics.captureException(err, event.locals.user?.id ?? 'server', {
		status,
		method: event.request.method,
		route: event.route?.id ?? '(unmatched)'
	});

	return { message: status === 500 ? 'Internal server error' : message };
}

const handleRequest: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const isSetupRoute = pathname.startsWith('/setup');
	const isAuthRoute = pathname.startsWith('/auth');

	if (!building) {
		if (!isSetupRoute) {
			// Redirect to setup wizard if the app hasn't been initialised yet.
			if (!(await isSetupComplete())) {
				throw redirect(303, '/setup');
			}

			// Load settings; if missing, redirect to setup rather than hard 500.
			try {
				const { app, observability } = await getAllSettings();
				event.locals.config = app;
				// Both only act when the settings changed, so a dashboard edit applies without a restart.
				applyTelemetry(observability.telemetry);
				await configureAnalytics(observability.analytics);
				const { provider, posthogHost, posthogToken } = observability.analytics;
				event.locals.analytics =
					provider === 'posthog' && posthogHost && posthogToken
						? { provider, host: posthogHost, token: posthogToken }
						: null;
			} catch (e) {
				if (e instanceof SettingsMissingError) {
					throw redirect(303, '/setup');
				}
				throw e;
			}
		}
	}

	if (isSetupRoute) {
		return resolve(event);
	}

	const auth = await getAuth();

	let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
	try {
		session = await auth.api.getSession({
			headers: event.request.headers
		});
	} catch {
		// Auth tables may not exist yet during initial setup.
	}

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;

		const impersonatedBy = (session.session as { impersonatedBy?: string | null }).impersonatedBy ?? null;

		// An impersonation session is the target user, so it never carries infra
		// access: the infra panel is closed to it and the infra services answer 403.
		const infraPermissions = impersonatedBy ? [] : await resolveInfraPermissions(session.user.id);
		event.locals.infrastructure = { permissions: infraPermissions };
		event.locals.impersonatedBy = impersonatedBy;

		if (impersonatedBy) {
			if (pathname.startsWith('/infra')) {
				throw error(403, 'Stop impersonating to use the infrastructure panel.');
			}
			if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
				await audit(impersonatedBy, 'impersonation.request', { type: 'user', id: session.user.id }, {
					method: event.request.method,
					path: pathname
				}).catch((e) => logger.error({ err: e }, '[audit] Could not record an impersonated request'));
			}
		}

		// Users with fake emails must set a real one before doing anything else.
		const isFakeEmail = session.user.email.endsWith('@fake.com');
		if (isFakeEmail && !isAuthRoute && pathname !== '/auth/update-email') {
			throw redirect(303, '/auth/update-email');
		}
	}

	// Resolve org from /o/[org_slug]/... URLs.
	const orgRouteMatch = event.url.pathname.match(/^\/o\/([^/]+)(\/|$)/);
	if (orgRouteMatch && session?.user) {
		const slug = orgRouteMatch[1];

		// A deleted org is treated as one that does not exist.
		const orgRow = await POOL.query(
			`SELECT id, name, slug, suspended_at FROM auth.organization WHERE slug = $1 AND deleted_at IS NULL`,
			[slug]
		);

		if (orgRow.rows.length > 0) {
			const org = orgRow.rows[0];

			if (org.suspended_at && !event.locals.infrastructure?.permissions.includes('access')) {
				throw error(403, 'This organization has been suspended. Contact support for help.');
			}

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

	if (session?.user && !event.locals.impersonatedBy) {
		touchActiveDay(session.user.id, event.locals.organization?.id);
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

// Static build assets are immutable and fetched in bursts; logging them is noise.
const ACCESS_LOG_SKIP = ['/_app/', '/favicon'];

/**
 * One log line per request, written after the response is built. Redirects and
 * errors thrown by the handlers below are read for their status, then rethrown
 * so SvelteKit still turns them into responses.
 */
async function withAccessLog(input: Parameters<Handle>[0], next: Handle) {
	const { event } = input;
	const { pathname } = event.url;
	if (building || ACCESS_LOG_SKIP.some((prefix) => pathname.startsWith(prefix))) {
		return next(input);
	}

	const startedAt = performance.now();
	const write = (status: number, response?: Response) => {
		const length = response?.headers.get('content-length');
		logger.info(
			{
				method: event.request.method,
				// The route pattern, such as /o/[org_slug]/s/turfs/[id], never the URL:
				// paths carry org slugs, invite tokens, turf codes and entity ids.
				route: event.route?.id ?? '(unmatched)',
				status,
				responseBytes: length ? Number(length) : undefined,
				durationMs: Math.round(performance.now() - startedAt),
				userId: event.locals.user?.id,
				organizationId: event.locals.organization?.id,
				impersonatedBy: event.locals.impersonatedBy ?? undefined
			},
			'request'
		);
	};

	try {
		const response = await next(input);
		write(response.status, response);
		return response;
	} catch (e) {
		if (isRedirect(e) || isHttpError(e)) write(e.status);
		else write(500);
		throw e;
	}
}

export const handle: Handle = (input) => withAccessLog(input, handleRequest);
