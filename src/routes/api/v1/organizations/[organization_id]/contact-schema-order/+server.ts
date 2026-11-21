import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { reorderContactSchemas } from '$lib/server/services/contact-schemas.service';
import { contactSchemaOrderSchema } from '$lib/shared/schemas/contact-schemas';

/**
 * Sets the order of the organization's contact schemas, which is the order of the tabs on the contacts page.
 *
 * @auth staff
 * @body ids {string[]} - Every contact schema id of the organization exactly once, in the new order
 * @returns 204. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when the caller is not a member, 409 when a schema was added or deleted since the caller loaded the list
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');
	const { ids } = await parseBody(request, contactSchemaOrderSchema);

	await reorderContactSchemas(userId, orgId, ids);
	return new Response(null, { status: 204 });
};
