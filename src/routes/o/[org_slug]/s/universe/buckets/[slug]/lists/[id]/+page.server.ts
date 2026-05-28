import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';

export async function load({ params, locals }) {
	if (!locals.organization) throw error(401, 'Unauthorized');

	return withOrgTransaction(locals.organization.id, async (client) => {
		// Load the list and verify it belongs to this org + bucket.
		const listResult = await client.query<{
			id: string;
			name: string;
			entity_type: string;
			expires_at: string;
			created_at: string;
		}>(
			`SELECT l.id, l.name, l.entity_type, l.expires_at, l.created_at
			 FROM universe.list l
			 JOIN universe.bucket b ON b.id = l.bucket
			 WHERE l.id = $1 AND l.org_id = $2 AND b.slug = $3`,
			[params.id, locals.organization!.id, params.slug]
		);

		if (listResult.rows.length === 0) throw error(404, 'List not found');

		const list = listResult.rows[0];

		// Load entries, joining back to the snapshotted temporal records
		// (not the view) so the data reflects the moment the list was created.
		let entries: Record<string, string | null>[] = [];

		if (list.entity_type === 'people') {
			const peopleResult = await client.query<{
				record_id: string;
				record_source: string;
				entity_id: string;
				first_name: string | null;
				last_name: string | null;
				email: string | null;
				phone: string | null;
			}>(
				`SELECT
					le.record_id,
					le.record_source,
					COALESCE(pp.entity_id, op.entity_id)::text AS entity_id,
					COALESCE(pp.first_name, op.first_name) AS first_name,
					COALESCE(pp.last_name,  op.last_name)  AS last_name,
					COALESCE(pp.email,      op.email)      AS email,
					COALESCE(pp.phone,      op.phone)      AS phone
				FROM universe.list_entry le
				LEFT JOIN universe.public_person pp
					ON le.record_source = 'public_person' AND pp.id = le.record_id
				LEFT JOIN universe.org_person op
					ON le.record_source = 'org_person'    AND op.id = le.record_id
				WHERE le.list_id = $1
				ORDER BY
					COALESCE(pp.last_name,  op.last_name),
					COALESCE(pp.first_name, op.first_name)`,
				[list.id]
			);
			entries = peopleResult.rows;
		} else {
			const locationsResult = await client.query<{
				record_id: string;
				record_source: string;
				entity_id: string;
				name: string | null;
				address_line_1: string | null;
				city: string | null;
				state_or_region: string | null;
				postal_code: string | null;
			}>(
				`SELECT
					le.record_id,
					le.record_source,
					COALESCE(pl.entity_id, ol.entity_id)::text AS entity_id,
					COALESCE(pl.name,           ol.name)           AS name,
					COALESCE(pl.address_line_1, ol.address_line_1) AS address_line_1,
					COALESCE(pl.city,           ol.city)           AS city,
					COALESCE(pl.state_or_region,ol.state_or_region)AS state_or_region,
					COALESCE(pl.postal_code,    ol.postal_code)    AS postal_code
				FROM universe.list_entry le
				LEFT JOIN universe.public_location pl
					ON le.record_source = 'public_location' AND pl.id = le.record_id
				LEFT JOIN universe.org_location ol
					ON le.record_source = 'org_location'    AND ol.id = le.record_id
				WHERE le.list_id = $1
				ORDER BY
					COALESCE(pl.city,  ol.city),
					COALESCE(pl.name,  ol.name)`,
				[list.id]
			);
			entries = locationsResult.rows;
		}

		const turfsResult = await client.query<{
			id: string;
			code: string;
			expires_at: string;
			created_at: string;
			author: string;
			survey_name: string | null;
			location_count: string;
		}>(
			`SELECT
				t.id, t.code, t.expires_at, t.created_at,
				u.username AS author,
				s.name AS survey_name,
				COUNT(tl.id)::text AS location_count
			 FROM turf t
			 JOIN auth.user u ON t.author_id = u.id
			 LEFT JOIN survey s ON t.survey_id = s.id
			 LEFT JOIN turf_location tl ON tl.turf_id = t.id
			 WHERE t.list_id = $1 AND t.organization_id = $2
			 GROUP BY t.id, u.username, s.name
			 ORDER BY t.created_at DESC`,
			[list.id, locals.organization!.id]
		);

		return { list, entries, turfs: turfsResult.rows };
	});
}
