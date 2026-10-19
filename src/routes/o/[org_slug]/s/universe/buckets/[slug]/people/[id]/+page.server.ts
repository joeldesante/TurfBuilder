import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import type { PersonProfile } from '$pages/o/s/universe/people/PersonProfilePage.svelte';

export async function load({ params, locals }) {
	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query<PersonProfile>(
			`SELECT
				op.id,
				op.first_name,
				op.middle_name,
				op.last_name,
				op.suffix,
				op.preferred_name,
				op.dob,
				op.phone,
				op.email,
				op.gender
			FROM universe.org_person op
			WHERE op.id = $1
			  AND op.org_id = $2
			  AND op.valid_to IS NULL`,
			[params.id, locals.organization!.id]
		);

		if (result.rows.length === 0) {
			throw error(404, 'Person not found');
		}

		return { person: result.rows[0] };
	});
}
