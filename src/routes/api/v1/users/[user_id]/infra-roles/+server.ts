import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/request';
import { grantInfraRole, listUserInfraRoles } from '$lib/server/services/infra-admins.service';

const grantSchema = z.object({ roleId: z.uuid('Choose a role.') });

/**
 * The user's infrastructure roles.
 *
 * @auth infra users.manage
 * @returns `{ id, name }[]`. 400 for an invalid id, 403 without users.manage, 404 for an unknown user
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	return json(await listUserInfraRoles(userId, parseId(params.user_id, 'user')));
};

/**
 * Gives the user an infrastructure role.
 *
 * @auth infra users.manage
 * @body roleId {uuid} - An infrastructure role
 * @returns 204. 400 for an invalid body, 403 without users.manage, 404 for an unknown user or role
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const targetId = parseId(params.user_id, 'user');
	const { roleId } = await parseBody(request, grantSchema);
	await grantInfraRole(userId, targetId, roleId);
	return new Response(null, { status: 204 });
};
