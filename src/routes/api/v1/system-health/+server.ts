import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { getSystemHealth } from '$lib/server/services/system-health.service';

/**
 * How the running instance is doing: Node and Postgres versions, database size and largest tables,
 * connection pool use, and whether migrations, mail, storage, and Chromium are set up.
 *
 * @auth infra access
 * @returns `SystemHealth`. 401 when signed out, 403 without infra access
 */
export const GET: RequestHandler = async ({ locals }) => {
	return json(await getSystemHealth(requireUser(locals)));
};
