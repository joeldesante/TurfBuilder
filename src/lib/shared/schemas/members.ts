import { z } from 'zod';

/** Body of `PATCH /api/v1/members/{member_id}`. A null role leaves the member with only the default role. */
export const updateMemberSchema = z.object({
	role_id: z.uuid('Invalid role id').nullable()
});

/** Body of `PUT /api/v1/members/{member_id}/permissions/{permission_id}`: grant (true) or deny (false). */
export const memberPermissionSchema = z.object({
	value: z.boolean()
});

/**
 * Body of `POST /api/v1/organizations/{organization_id}/invite-links`. The
 * expiry is a date (`2026-12-31`, good through that day in UTC) or an ISO datetime;
 * null or omitted means the link never expires.
 */
export const createInviteLinkSchema = z.object({
	expires_at: z
		.union([z.iso.date(), z.iso.datetime({ offset: true })], { error: 'Invalid expiry date' })
		.nullable()
		.optional()
});

/** Body of `PUT /api/v1/organizations/{organization_id}/slug-invite`. */
export const slugInviteSchema = z.object({
	enabled: z.boolean()
});
