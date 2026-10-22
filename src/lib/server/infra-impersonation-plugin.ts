import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint, sessionMiddleware } from 'better-auth/api';
import { deleteSessionCookie, setSessionCookie } from 'better-auth/cookies';
import { z } from 'zod';
import { canInfra } from '$lib/server/permissions';

/** How long an impersonation session lasts before the admin has to start again. */
export const IMPERSONATION_SECONDS = 60 * 60;

/** The endpoint context the handler uses: better-auth's, with the body checked by the endpoint. */
type ImpersonateContext = Parameters<typeof setSessionCookie>[0] & { body: { userId: string } };

/**
 * Starts the impersonation. Exported so its refusals and cookie handling can
 * be tested without a running better-auth.
 */
export async function impersonateHandler(ctx: ImpersonateContext) {
	const admin = ctx.context.session;
	if (!admin) throw new APIError('UNAUTHORIZED', { message: 'Sign in first.' });
	if ((admin.session as { impersonatedBy?: string | null }).impersonatedBy) {
		throw new APIError('FORBIDDEN', { message: 'Stop impersonating before starting again.' });
	}
	if (!(await canInfra(admin.user.id, 'users.impersonate'))) {
		throw new APIError('FORBIDDEN', { message: 'You are not allowed to impersonate users.' });
	}
	if (ctx.body.userId === admin.user.id) {
		throw new APIError('BAD_REQUEST', { message: 'You cannot impersonate yourself.' });
	}

	const target = await ctx.context.internalAdapter.findUserById(ctx.body.userId);
	if (!target) throw new APIError('NOT_FOUND', { message: 'User not found.' });
	if (await canInfra(target.id, 'access')) {
		throw new APIError('FORBIDDEN', { message: 'Infrastructure admins cannot be impersonated.' });
	}

	const session = await ctx.context.internalAdapter.createSession(
		target.id,
		true,
		{
			impersonatedBy: admin.user.id,
			expiresAt: new Date(Date.now() + IMPERSONATION_SECONDS * 1000)
		},
		true
	);
	if (!session) throw new APIError('INTERNAL_SERVER_ERROR', { message: 'Could not start the session.' });

	const authCookies = ctx.context.authCookies;
	deleteSessionCookie(ctx);
	const dontRememberMe = await ctx.getSignedCookie(
		authCookies.dontRememberToken.name,
		ctx.context.secret
	);
	const adminCookie = ctx.context.createAuthCookie('admin_session');
	await ctx.setSignedCookie(
		adminCookie.name,
		`${admin.session.token}:${dontRememberMe || ''}`,
		ctx.context.secret,
		authCookies.sessionToken.attributes
	);
	await setSessionCookie(ctx, { session, user: target }, true);

	return ctx.json({ sessionId: session.id, userId: target.id, expiresAt: session.expiresAt });
}

/**
 * Lets an infra admin with `users.impersonate` sign in as another user.
 *
 * It does what the admin plugin's impersonateUser does, but checks our infra
 * permissions instead of better-auth roles, which this app does not use. The
 * session it creates carries `impersonatedBy` and the admin's own session is
 * kept in the admin plugin's `admin_session` cookie, so the admin plugin's
 * stopImpersonating restores it unchanged.
 */
export function infraImpersonation() {
	return {
		id: 'infra-impersonation',
		endpoints: {
			infraImpersonateUser: createAuthEndpoint(
				'/infra/impersonate-user',
				{
					method: 'POST',
					body: z.object({ userId: z.string() }),
					use: [sessionMiddleware]
				},
				(ctx) => impersonateHandler(ctx)
			)
		}
	} satisfies BetterAuthPlugin;
}
