import { z } from 'zod';

/** Body of `POST /api/v1/organizations/{organization_id}/turf-memberships`: a turf's join code. */
export const joinTurfSchema = z.object({
	code: z.string().trim().length(6, 'Enter the 6-character code.')
});
