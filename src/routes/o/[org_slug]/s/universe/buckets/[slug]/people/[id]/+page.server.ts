import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import type { PersonProfile } from '$pages/universe/people/PersonProfilePage.svelte';

export async function load({ params, locals }) {
	return withOrgTransaction(locals.organization!.id, async (client) => {
		const result = await client.query<PersonProfile>(
			`SELECT
				pp.id,
				pp.first_name,
				pp.middle_name,
				pp.last_name,
				pp.suffix,
				pp.preferred_name,
				pp.dob,
				pp.phone,
				pp.email,
				pp.gender,
				'public'::text AS source
			FROM universe.public_person pp
			WHERE pp.id = $1
			  AND pp.valid_to IS NULL

			UNION ALL

			SELECT
				op.id,
				op.first_name,
				op.middle_name,
				op.last_name,
				op.suffix,
				op.preferred_name,
				op.dob,
				op.phone,
				op.email,
				op.gender,
				'org'::text AS source
			FROM universe.org_person op
			WHERE op.id = $1
			  AND op.org_id = $2
			  AND op.valid_to IS NULL

			LIMIT 1`,
			[params.id, locals.organization!.id]
		);

		if (result.rows.length === 0) {
			throw error(404, 'Person not found');
		}

		return { person: result.rows[0] };
	});
}
