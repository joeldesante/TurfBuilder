import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database';
import { requireOrgPermission } from '$lib/server/list-access';
import { currentAddressJoin, line1Sql, line2Sql, nameSql } from './contact-columns';

/**
 * The entity page: one person or location, current or at a given version.
 * A location version is shown at the address its contact was at then: the
 * address version in force when the contact version was made.
 */

export interface PersonRecord {
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
}

export interface LocationRecord {
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
}

export type EntityView =
	| { entityType: 'person'; entityId: string; record: PersonRecord; isOutdated: boolean }
	| { entityType: 'location'; entityId: string; record: LocationRecord; isOutdated: boolean };

const PERSON_COLUMNS = `op.id, op.entity_id, op.first_name, op.middle_name, op.last_name,
	op.suffix, op.preferred_name, op.dob, op.phone, op.email, op.gender, op.valid_to`;

/** The flat location columns of contact `c` at address `a`, as LocationRecord. */
const LOCATION_COLUMNS = `c.id, c.entity_id,
	${nameSql('c')} AS name,
	${line1Sql('a')} AS address_line_1,
	${line2Sql('a')} AS address_line_2,
	NULL::text AS address_line_3,
	a.locality AS city, a.region AS state_or_region, a.postcode AS postal_code,
	a.country_code::text AS country_code, c.valid_to`;

/**
 * An entity of the org, by its entity id, at `versionId` when given (which may
 * be outdated) or else its current version. 404 when it is not in the org or
 * has no such version, 403 without staff access.
 */
export async function getEntity(
	userId: string,
	orgId: string,
	entityId: string,
	versionId: string | null
): Promise<EntityView> {
	await requireOrgPermission(userId, orgId, 'system.access');

	return withOrgTransaction(orgId, async (client) => {
		const entity = await client.query<{ type_slug: string }>(
			`SELECT et.slug AS type_slug
			   FROM universe.org_entity oe
			   JOIN universe.entity_type et ON et.id = oe.type_id
			  WHERE oe.id = $1 AND oe.org_id = $2`,
			[entityId, orgId]
		);
		if (entity.rows.length === 0) throw error(404, 'Entity not found');
		const { type_slug } = entity.rows[0];

		if (type_slug === 'person') {
			const result = await client.query<PersonRecord>(
				versionId
					? `SELECT ${PERSON_COLUMNS} FROM universe.org_person op
					    WHERE op.id = $3 AND op.entity_id = $1 AND op.org_id = $2`
					: `SELECT ${PERSON_COLUMNS} FROM universe.org_person op
					    WHERE op.entity_id = $1 AND op.org_id = $2 AND op.valid_to IS NULL`,
				versionId ? [entityId, orgId, versionId] : [entityId, orgId]
			);
			const record = result.rows[0];
			if (!record) throw error(404, 'Person not found');
			return { entityType: 'person', entityId, record, isOutdated: record.valid_to !== null };
		}

		if (type_slug === 'contact') {
			const result = await client.query<LocationRecord>(
				versionId
					? `SELECT ${LOCATION_COLUMNS}
					     FROM universe.org_contact c
					     CROSS JOIN LATERAL (
					       SELECT * FROM universe.org_address a
					        WHERE a.entity_id = c.address_entity_id AND a.org_id = c.org_id
					        ORDER BY (a.valid_from <= c.valid_from) DESC,
					                 CASE WHEN a.valid_from <= c.valid_from THEN a.valid_from END DESC NULLS LAST,
					                 a.valid_from ASC
					        LIMIT 1
					     ) a
					    WHERE c.id = $3 AND c.entity_id = $1 AND c.org_id = $2`
					: `SELECT ${LOCATION_COLUMNS}
					     FROM universe.org_contact c
					     ${currentAddressJoin('c', 'a')}
					    WHERE c.entity_id = $1 AND c.org_id = $2 AND c.valid_to IS NULL`,
				versionId ? [entityId, orgId, versionId] : [entityId, orgId]
			);
			const record = result.rows[0];
			if (!record) throw error(404, 'Location not found');
			return { entityType: 'location', entityId, record, isOutdated: record.valid_to !== null };
		}

		throw error(400, `Unsupported entity type: ${type_slug}`);
	});
}
