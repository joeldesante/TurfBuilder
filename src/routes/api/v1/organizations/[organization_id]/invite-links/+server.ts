import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { parseBody } from '$lib/server/utils/request';
import { createInviteLink, listInviteLinks } from '$lib/server/services/invite-links.service';
import { createInviteLinkSchema } from '$lib/shared/schemas/members';

/**
 * The organization's invite links, newest first, and whether its open slug invite is on.
 *
 * @auth member.invite
 * @returns `{ links: Array<{ id, created_at, expires_at }>, slugInviteEnabled }`. 400 for an invalid id, 401 when signed out, 403 without `member.invite`, 404 when the caller is not a member
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');

	return json(await listInviteLinks(userId, orgId));
};

/**
 * Creates an invite link. Anyone with `/invite/{id}` can join until it expires.
 *
 * @auth member.invite
 * @body expires_at {string|null} - Optional. A date (`2026-12-31`) or ISO datetime; omitted or null never expires
 * @returns 201 with `{ id, created_at, expires_at }`. 400 for an invalid id or body, 401 when signed out, 403 without `member.invite`, 404 when the caller is not a member
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');
	const { expires_at } = await parseBody(request, createInviteLinkSchema);

	return json(await createInviteLink(userId, orgId, expires_at ?? null), { status: 201 });
};
