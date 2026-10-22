import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { listInfraRoles } from '$lib/server/services/infra-admins.service';

/**
 * Every infrastructure role, with the permissions it grants and how many hold it.
 *
 * @auth infra users.manage
 * @returns `InfraRole[]`. 401 when signed out, 403 without users.manage
 */
export const GET: RequestHandler = async ({ locals }) => {
	const userId = requireUser(locals);
	return json(await listInfraRoles(userId));
};
