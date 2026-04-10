import { redirect, error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';

export async function load({ locals, params }) {
	if (!locals.user) {
		throw redirect(303, '/auth/signin');
	}

	const turfId = params.id;
	const orgId = locals.organization!.id;
	const userId = locals.user.id;

	return withOrgTransaction(orgId, async (client) => {
		const membership = await client.query(
			`SELECT id FROM turf_user WHERE turf_id = $1 AND user_id = $2 AND organization_id = $3`,
			[turfId, userId, orgId]
		);

		if (membership.rows.length === 0) {
			throw error(403, 'You have not been added to this turf');
		}
	});
}
