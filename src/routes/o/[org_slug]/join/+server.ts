import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as z from 'zod';
import { withOrgTransaction } from '$lib/server/database';

const JoinSchema = z.object({
	code: z.string().length(6)
});

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

	// Then, extract the code, and using RLS query check the database for the map code
	const turf = await withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query(
				`SELECT * FROM turf WHERE code = $1 AND organization_id = $2`,
				[ body.code, locals.organization!.id ]
		);
		return result.rows[0] ?? null;
	});
	
	if(!turf) {
		return json({ error: 'Invalid code' }, { status: 404 });
	}

	// When found, try to insert the user into the list of turf_users. If they alredy exist (ON CONFLIT) move to the next step.
	await withOrgTransaction(locals.organization!.id, async (client) => {
		await client.query(
			`INSERT INTO turf_user (turf_id, user_id, organization_id)
			 VALUES ($1, $2, $3)
			 ON CONFLICT DO NOTHING`,
			[turf.id, locals.user!.id, locals.organization!.id]
		);
	});

	// Return the map UUID to the client so they can proceed to the map page
	return json({ id: turf.id });
};
