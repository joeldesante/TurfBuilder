import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/request';
import { deleteUserSchema, updateUserSchema } from '$lib/shared/schemas/platform-users';
import { deleteUser, getUser, updateUser } from '$lib/server/services/platform-users.service';

/**
 * One user, with their sign-in methods, infra roles, and suspension.
 *
 * @auth infra access
 * @returns `PlatformUserDetail`. 400 for an invalid id, 401 when signed out, 403 without infra access, 404 for an unknown user
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	return json(await getUser(userId, parseId(params.user_id, 'user')));
};

/**
 * Edits the given fields. A new email is unverified unless `emailVerified` is sent too.
 *
 * @auth infra users.manage
 * @body name {string} - Optional
 * @body email {string} - Optional
 * @body username {string} - Optional
 * @body emailVerified {boolean} - Optional
 * @returns `PlatformUserDetail`. 400 for an invalid body, 403 without users.manage, 404 for an unknown user, 409 for a taken email or username or a deleted account
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const targetId = parseId(params.user_id, 'user');
	return json(await updateUser(userId, targetId, await parseBody(request, updateUserSchema)));
};

/**
 * Deletes the account by anonymizing it: the user's records in orgs stay, their
 * name, email, and sign-in methods do not, and they leave every org.
 *
 * @auth infra users.manage
 * @body confirmEmail {string} - The account's email, typed to confirm
 * @returns 204. 400 when the email does not match or for yourself, 403 without users.manage, 404 for an unknown user, 409 when they are an org's only owner or the last admin
 */
export const DELETE: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const targetId = parseId(params.user_id, 'user');
	const { confirmEmail } = await parseBody(request, deleteUserSchema);
	await deleteUser(userId, targetId, confirmEmail);
	return new Response(null, { status: 204 });
};
