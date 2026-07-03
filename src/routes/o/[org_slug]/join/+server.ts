import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as z from 'zod';
import { withOrgTransaction } from '$lib/server/database';

const JoinSchema = z.object({
	code: z.string().length(6)
});

/**
 * Adds the authenticated user to a turf using a 6-character join code.
 * If the user is already in the turf the insert is silently ignored.
 *
 * @auth org
 * @body code {string} required - 6-character alphanumeric turf join code
 * @returns { id: string } UUID of the turf that was joined
 */
export const POST: RequestHandler = async ({ request, locals }) => {

	if(!locals.user) {
		return new Response('Unauthorized', { status: 401 });
	}

	// Check if the incoming JSON matches the expected schema
	const body = await request.json();

	const result = JoinSchema.safeParse(body);
	if (!result.success) {
		return json({ errors: z.flattenError(result.error).fieldErrors }, { status: 400 });
	}

	// Look up the turf by join code, then add the user to it. If they are
	// already a turf member the insert is silently ignored.
	const turf = await withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query(
			`SELECT id FROM universe.turf WHERE code = $1 AND org_id = $2`,
			[body.code, locals.organization!.id]
		);
		const found = result.rows[0] ?? null;
		if (!found) return null;

		await client.query(
			`INSERT INTO universe.turf_user (turf_id, user_id, org_id)
			 VALUES ($1, $2, $3)
			 ON CONFLICT DO NOTHING`,
			[found.id, locals.user!.id, locals.organization!.id]
		);
		return found;
	});

	if (!turf) {
		return json({ error: 'Invalid code' }, { status: 404 });
	}

	// Return the turf UUID to the client so they can proceed to the map page
	return json({ id: turf.id });
};
