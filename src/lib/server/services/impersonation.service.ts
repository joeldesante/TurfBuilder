import { error } from '@sveltejs/kit';
import { getAuth } from '$lib/auth';
import { POOL } from '$lib/server/database';
import { requireInfraPermission } from '$lib/server/permissions';
import { audit } from './audit.service';

function statusOf(e: unknown): number | undefined {
	const err = e as { statusCode?: number; status?: number | string };
	if (typeof err.statusCode === 'number') return err.statusCode;
	if (typeof err.status === 'number') return err.status;
	return undefined;
}

/**
 * Signs the admin in as the user for an hour. better-auth swaps the session
 * cookie through the request's cookies (sveltekitCookies), keeping the admin's
 * own session to restore when they stop. 403 without `users.impersonate`.
 */
export async function startImpersonation(
	userId: string,
	targetId: string,
	headers: Headers
): Promise<{ userId: string; expiresAt: string }> {
	await requireInfraPermission(userId, 'users.impersonate');

	const target = await POOL.query<{ name: string; email: string; deleted_at: Date | null }>(
		`SELECT name, email, deleted_at FROM auth.user WHERE id = $1`,
		[targetId]
	);
	if (!target.rowCount) throw error(404, 'User not found.');
	if (target.rows[0].deleted_at) throw error(409, 'This account was deleted.');

	const auth = await getAuth();
	let result: { sessionId: string; userId: string; expiresAt: Date | string };
	try {
		result = await auth.api.infraImpersonateUser({ body: { userId: targetId }, headers });
	} catch (e) {
		const status = statusOf(e);
		const message = (e as { body?: { message?: string } }).body?.message;
		if (status && status < 500 && message) throw error(status, message);
		throw e;
	}

	// The session already exists, so it cannot share a transaction with the
	// record. If the record cannot be written, end the session: no
	// impersonation runs unrecorded.
	try {
		await audit(userId, 'user.impersonate.start', { type: 'user', id: targetId }, {
			name: target.rows[0].name,
			email: target.rows[0].email
		});
	} catch (e) {
		await POOL.query(`DELETE FROM auth.session WHERE id = $1`, [result.sessionId]).catch(() => {});
		throw e;
	}
	return { userId: result.userId, expiresAt: new Date(result.expiresAt).toISOString() };
}

/**
 * Ends the impersonation and restores the admin's own session. Answers 409
 * when the caller is not impersonating anyone. Returns who was impersonated,
 * so the client can go back to their page.
 */
export async function stopImpersonation(
	locals: App.Locals,
	headers: Headers
): Promise<{ userId: string }> {
	const adminId = locals.impersonatedBy;
	const targetId = locals.user?.id;
	if (!adminId || !targetId) throw error(409, 'You are not impersonating anyone.');

	const auth = await getAuth();
	try {
		await auth.api.stopImpersonating({ headers });
	} catch (e) {
		const status = statusOf(e);
		if (status && status < 500) throw error(409, 'The impersonation could not be ended. Sign out and sign in again.');
		throw e;
	}

	await audit(adminId, 'user.impersonate.stop', { type: 'user', id: targetId });
	return { userId: targetId };
}
