import { z } from 'zod';

const name = z
	.string()
	.trim()
	.min(1, 'Name is required.')
	.max(255, 'Name must be 255 characters or fewer.');

/** Body of `POST /api/v1/organizations/{organization_id}/roles`. */
export const createRoleSchema = z.object({
	name,
	/** Lower comes first; 0 is the administrator role. New roles default to 500. */
	weight: z.number().int().min(1).max(10000).optional()
});

/** Body of `PATCH /api/v1/roles/{role_id}`. */
export const updateRoleSchema = z.object({ name });

/** Body of `PUT /api/v1/roles/{role_id}/permissions`: the full set of keys the role grants. */
export const rolePermissionsSchema = z.object({
	permissions: z.array(z.string()).max(500)
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
