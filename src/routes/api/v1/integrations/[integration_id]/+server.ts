import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { setIntegrationEnabled } from '$lib/server/services/integrations.service';

const ID = /^[a-z0-9_]{1,100}$/;
const patchSchema = z.object({ enabled: z.boolean() });

/**
 * Turns an integration on or off for every organization on the instance.
 *
 * @auth infra settings.manage
 * @body enabled {boolean}
 * @returns `{ enabled }`. 400 for an invalid id or body, 401 when signed out, 403 without `settings.manage`, 404 for an unknown integration
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	if (!ID.test(params.integration_id)) throw error(400, 'Invalid integration id');
	const { enabled } = await parseBody(request, patchSchema);

	await setIntegrationEnabled(userId, params.integration_id, enabled);
	return json({ enabled });
};
