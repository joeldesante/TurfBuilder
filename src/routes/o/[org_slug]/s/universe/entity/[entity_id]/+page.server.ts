import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';

export async function load({ params, locals, url }) {
	if (!locals.organization) throw error(401, 'Unauthorized');

	// Optional: view a specific temporal record version by its record ID.
	const versionId = url.searchParams.get('version') ?? null;

	// Optional: base64-encoded return path so the UI can show a "Back" link.
	let backHref: string | undefined;
	const backHrefParam = url.searchParams.get('backHref');
	if (backHrefParam) {
		try {
			const decoded = decodeURIComponent(backHrefParam);
			if (decoded.startsWith('/')) backHref = decoded;
		} catch {
			// Ignore malformed percent-encoding — backHref remains undefined.
		}
	}

	return withOrgTransaction(locals.organization.id, async (client) => {
		// Resolve the entity and its type.
		const entityResult = await client.query<{ type_slug: string }>(
			`SELECT et.slug AS type_slug
			 FROM universe.org_entity oe
			 JOIN universe.entity_type et ON et.id = oe.type_id
			 WHERE oe.id = $1 AND oe.org_id = $2`,
			[params.entity_id, locals.organization!.id]
		);

		if (entityResult.rows.length === 0) throw error(404, 'Entity not found');

		const { type_slug } = entityResult.rows[0];

		if (type_slug === 'person') {
			const personResult = await client.query<{
				id: string;
				entity_id: string;
				first_name: string | null;
				middle_name: string | null;
				last_name: string | null;
				suffix: string | null;
				preferred_name: string | null;
				dob: string | null;
				phone: string | null;
				email: string | null;
				gender: string | null;
				valid_to: string | null;
			}>(
				versionId
					? // Load the specific requested version (may be outdated).
						`SELECT op.id, op.entity_id, op.first_name, op.middle_name, op.last_name,
						        op.suffix, op.preferred_name, op.dob, op.phone, op.email, op.gender,
						        op.valid_to
						 FROM universe.org_person op
						 WHERE op.id = $1 AND op.entity_id = $2 AND op.org_id = $3`
					: // Load the current version.
						`SELECT op.id, op.entity_id, op.first_name, op.middle_name, op.last_name,
						        op.suffix, op.preferred_name, op.dob, op.phone, op.email, op.gender,
						        op.valid_to
						 FROM universe.org_person op
						 WHERE op.entity_id = $1 AND op.valid_to IS NULL AND op.org_id = $2`,
				versionId
					? [versionId, params.entity_id, locals.organization!.id]
					: [params.entity_id, locals.organization!.id]
			);

			if (personResult.rows.length === 0) throw error(404, 'Person not found');

			const record = personResult.rows[0];
			return {
				entityType: 'person' as const,
				entityId: params.entity_id,
				record,
				isOutdated: record.valid_to !== null,
				backHref
			};
		}

		if (type_slug === 'location') {
			const locationResult = await client.query<{
				id: string;
				entity_id: string;
				name: string | null;
				address_line_1: string | null;
				address_line_2: string | null;
				address_line_3: string | null;
				city: string | null;
				state_or_region: string | null;
				postal_code: string | null;
				country_code: string | null;
				valid_to: string | null;
			}>(
				versionId
					? `SELECT ol.id, ol.entity_id, ol.name, ol.address_line_1, ol.address_line_2,
					          ol.address_line_3, ol.city, ol.state_or_region, ol.postal_code,
					          ol.country_code, ol.valid_to
					   FROM universe.org_location ol
					   WHERE ol.id = $1 AND ol.entity_id = $2 AND ol.org_id = $3`
					: `SELECT ol.id, ol.entity_id, ol.name, ol.address_line_1, ol.address_line_2,
					          ol.address_line_3, ol.city, ol.state_or_region, ol.postal_code,
					          ol.country_code, ol.valid_to
					   FROM universe.org_location ol
					   WHERE ol.entity_id = $1 AND ol.valid_to IS NULL AND ol.org_id = $2`,
				versionId
					? [versionId, params.entity_id, locals.organization!.id]
					: [params.entity_id, locals.organization!.id]
			);

			if (locationResult.rows.length === 0) throw error(404, 'Location not found');

			const record = locationResult.rows[0];
			return {
				entityType: 'location' as const,
				entityId: params.entity_id,
				record,
				isOutdated: record.valid_to !== null,
				backHref
			};
		}

		throw error(400, `Unsupported entity type: ${type_slug}`);
	});
}
