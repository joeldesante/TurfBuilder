import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { setSlugInvite } from '$lib/server/services/invite-links.service';
import { slugInviteSchema } from '$lib/shared/schemas/members';

/**
 * Turns the open slug invite on or off. While on, anyone with
 * `/invite/{org_slug}` can join.
 *
 * @auth member.invite
 * @body enabled {boolean}
 * @returns `{ enabled }`. 400 for an invalid id or body, 401 when signed out, 403 without `member.invite`, 404 when the caller is not a member
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');
	const { enabled } = await parseBody(request, slugInviteSchema);

	await setSlugInvite(userId, orgId, enabled);
	return json({ enabled });
};
