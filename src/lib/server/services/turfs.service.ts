import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { customAlphabet } from 'nanoid';
import { z } from 'zod';
import { withOrgTransaction } from '$lib/server/database';
import {
	requireActiveMembership,
	requireListAccess,
	requireListOrg,
	requireTurfOrg
} from '$lib/server/list-access';
import { canOrg } from '$lib/server/permissions';
import { recordEvent } from './activity.service';
import { line1Sql, nameSql } from './contact-columns';

/**
 * Turfs: the walkable pieces cut from a list, which canvassers join with a
 * six-character code.
 */

/**
 * Adds the caller to the org's turf with this join code and returns the
 * turf's id. Any member may join, staff or not. Joining a turf the caller is
 * already on changes nothing. 404 for a code no turf in the org has.
 */
export async function joinTurfByCode(
	userId: string,
	orgId: string,
	code: string
): Promise<{ id: string }> {
	await requireActiveMembership(userId, orgId);

	const turf = await withOrgTransaction(orgId, async (client) => {
		const found = await client.query<{ id: string }>(
			`SELECT id FROM universe.turf WHERE code = $1 AND org_id = $2`,
			[code, orgId]
		);
		const turf = found.rows[0];
		if (!turf) return null;

		await client.query(
			`INSERT INTO universe.turf_user (turf_id, user_id, org_id)
			 VALUES ($1, $2, $3)
			 ON CONFLICT DO NOTHING`,
			[turf.id, userId, orgId]
		);
		return turf;
	});
	if (!turf) throw error(404, 'Invalid code');

	return { id: turf.id };
}

// ---------------------------------------------------------------------------
// Staff: cutting turfs from a list and looking at them
//
// A turf is a snapshot of its list: each door records the contact version and
// the address version the list recorded, and these reads show exactly those.
// ---------------------------------------------------------------------------

/** 403 without the permission. Must run inside withOrgTransaction. */
async function requirePermission(
	client: PoolClient,
	userId: string,
	orgId: string,
	permission: string
): Promise<void> {
	if (!(await canOrg(client, userId, orgId, permission))) throw error(403, 'Forbidden');
}

export const CreateTurfsSchema = z.object({
	polygons: z
		.array(z.object({ geometry: z.record(z.string(), z.unknown()) }))
		.min(1, 'At least one polygon is required.'),
	survey_id: z.string().uuid('Invalid survey ID.'),
	script_id: z.string().uuid().nullable().optional(),
	expires_at: z.coerce.date().optional(),
	/** Ignored: the list is the one in the path. Accepted so older clients keep working. */
	list_id: z.string().uuid().optional()
});

export type CreateTurfsInput = z.infer<typeof CreateTurfsSchema>;

export interface CreatedTurf {
	id: string;
	code: string;
	list_id: string;
	survey_id: string | null;
	script_id: string | null;
	expires_at: string;
	created_at: string;
}

const joinCode = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

/**
 * Cuts one turf per polygon from a list: each gets the list's locations inside
 * it as its doors, and a six-character join code. Expires in 7 days unless
 * told otherwise. 404 when the list is in none of the caller's orgs, 403
 * without `turf.create`.
 */
export async function createListTurfs(
	userId: string,
	listId: string,
	input: CreateTurfsInput
): Promise<CreatedTurf[]> {
	const orgId = await requireListOrg(userId, listId);

	const expiresAt = input.expires_at ?? new Date(Date.now() + 7 * 86_400_000);

	const turfs = await withOrgTransaction(orgId, async (client) => {
		await requirePermission(client, userId, orgId, 'turf.create');

		const created: CreatedTurf[] = [];
		for (const polygon of input.polygons) {
			const geojson = JSON.stringify(polygon.geometry);
			const result = await client.query<CreatedTurf>(
				`INSERT INTO universe.turf (code, bounds, author_id, survey_id, script_id, org_id, expires_at, list_id)
				 VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3, $4, $5, $6, $7, $8)
				 RETURNING id, code, list_id, survey_id, script_id, expires_at, created_at`,
				[
					joinCode(),
					geojson,
					userId,
					input.survey_id,
					input.script_id ?? null,
					orgId,
					expiresAt,
					listId
				]
			);
			const turf = result.rows[0];

			// The list's locations inside the polygon, at the versions the list recorded.
			await client.query(
				`INSERT INTO universe.turf_location (turf_id, contact_id, address_id, org_id)
				 SELECT $1, le.record_id, le.address_id, $3
				 FROM universe.list_entry le
				 JOIN universe.org_address a ON a.id = le.address_id AND a.org_id = $3
				 WHERE le.list_id = $4
				   AND le.record_source = 'org_contact'
				   AND ST_Contains(ST_SetSRID(ST_GeomFromGeoJSON($2::text), 4326), a.coordinates)
				 ON CONFLICT DO NOTHING`,
				[turf.id, geojson, orgId, listId]
			);
			created.push(turf);
		}
		return created;
	});

	for (const turf of turfs) {
		await recordEvent('turf.created', { userId, orgId, sourceKey: `turf.created:${turf.id}` });
	}
	return turfs;
}

export interface ListTurf {
	id: string;
	code: string;
	created_at: string;
	expires_at: string;
	author: string;
	survey_name: string | null;
	bounds: string | null;
}

/** A list's turfs with their outlines as GeoJSON text, newest first. 404 when the list is in none of the caller's orgs, 403 without staff access. */
export async function listListTurfs(userId: string, listId: string): Promise<ListTurf[]> {
	const orgId = await requireListOrg(userId, listId);

	return withOrgTransaction(orgId, async (client) => {
		await requireListAccess(client, userId, orgId, listId);

		const result = await client.query<ListTurf>(
			`SELECT t.id, t.code, t.created_at, t.expires_at,
			        u.username AS author,
			        s.name AS survey_name,
			        ST_AsGeoJSON(t.bounds)::text AS bounds
			   FROM universe.turf t
			   JOIN auth.user u ON t.author_id = u.id
			   LEFT JOIN universe.survey s ON t.survey_id = s.id AND s.org_id = t.org_id
			  WHERE t.list_id = $1 AND t.org_id = $2 AND t.bounds IS NOT NULL
			  ORDER BY t.created_at DESC`,
			[listId, orgId]
		);
		return result.rows;
	});
}

export interface ListLocation {
	record_id: string;
	record_source: string;
	name: string | null;
	address_line_1: string | null;
	city: string | null;
	state_or_region: string | null;
	postal_code: string | null;
	latitude: number;
	longitude: number;
	contact_made: boolean | null;
}

/**
 * Every location on a list with its pin, for the list map, and the latest
 * outcome at it on the list's turfs. 404 when the list is in none of the
 * caller's orgs, 403 without staff access, 400 for a list of people.
 */
export async function listListLocations(userId: string, listId: string): Promise<ListLocation[]> {
	const orgId = await requireListOrg(userId, listId);

	return withOrgTransaction(orgId, async (client) => {
		await requireListAccess(client, userId, orgId, listId);

		const list = await client.query<{ entity_type: string }>(
			`SELECT entity_type FROM universe.list WHERE id = $1 AND org_id = $2`,
			[listId, orgId]
		);
		if (list.rows[0]?.entity_type !== 'locations') {
			throw error(400, 'List is not a locations list');
		}

		const result = await client.query<ListLocation>(
			`SELECT le.record_id, le.record_source,
			        ${nameSql('c')} AS name,
			        ${line1Sql('a')} AS address_line_1,
			        a.locality AS city,
			        a.region AS state_or_region,
			        a.postcode AS postal_code,
			        ST_Y(a.coordinates) AS latitude,
			        ST_X(a.coordinates) AS longitude,
			        (SELECT tla.contact_made
			           FROM universe.turf_location tl
			           JOIN universe.turf t ON t.id = tl.turf_id AND t.list_id = le.list_id AND t.org_id = $2
			           JOIN universe.turf_location_attempt tla ON tla.turf_location_id = tl.id
			          WHERE tl.contact_id = le.record_id AND tl.org_id = $2
			          ORDER BY tla.updated_at DESC
			          LIMIT 1) AS contact_made
			   FROM universe.list_entry le
			   JOIN universe.org_contact c
			     ON le.record_source = 'org_contact' AND c.id = le.record_id AND c.org_id = $2
			   JOIN universe.org_address a ON a.id = le.address_id AND a.org_id = $2
			  WHERE le.list_id = $1`,
			[listId, orgId]
		);
		return result.rows;
	});
}

export interface TurfPreview {
	turf: { id: string; code: string; bounds: string | null };
	locations: {
		id: string;
		name: string | null;
		address_line_1: string | null;
		city: string | null;
		state_or_region: string | null;
		latitude: number;
		longitude: number;
		contact_made: boolean | null;
	}[];
}

/** A turf's outline and doors with the latest outcome at each, for the map preview. 404 when it is in none of the caller's orgs, 403 without staff access. */
export async function getTurfPreview(userId: string, turfId: string): Promise<TurfPreview> {
	const orgId = await requireTurfOrg(userId, turfId);

	return withOrgTransaction(orgId, async (client) => {
		await requirePermission(client, userId, orgId, 'system.access');

		const turf = await client.query<TurfPreview['turf']>(
			`SELECT id, code, ST_AsGeoJSON(bounds)::text AS bounds
			   FROM universe.turf WHERE id = $1 AND org_id = $2`,
			[turfId, orgId]
		);
		if (turf.rows.length === 0) throw error(404, 'Turf not found');

		const doors = await client.query<TurfPreview['locations'][number]>(
			`SELECT tl.id,
			        ${nameSql('c')} AS name,
			        ${line1Sql('a')} AS address_line_1,
			        a.locality AS city,
			        a.region AS state_or_region,
			        ST_Y(a.coordinates) AS latitude,
			        ST_X(a.coordinates) AS longitude,
			        (SELECT tla.contact_made FROM universe.turf_location_attempt tla
			          WHERE tla.turf_location_id = tl.id
			          ORDER BY tla.updated_at DESC LIMIT 1) AS contact_made
			   FROM universe.turf_location tl
			   JOIN universe.org_contact c ON c.id = tl.contact_id AND c.org_id = $2
			   JOIN universe.org_address a ON a.id = tl.address_id AND a.org_id = $2
			  WHERE tl.turf_id = $1 AND tl.org_id = $2
			  ORDER BY name`,
			[turfId, orgId]
		);

		return { turf: turf.rows[0], locations: doors.rows };
	});
}

export interface TurfReport {
	turf: {
		id: string;
		code: string;
		expires_at: string;
		created_at: string;
		author: string;
		survey_name: string | null;
		bounds: string | null;
		list_name: string;
		bucket_name: string;
	};
	locations: {
		turf_location_id: string;
		name: string | null;
		address_line_1: string | null;
		city: string | null;
		state_or_region: string | null;
		latitude: number | null;
		longitude: number | null;
		attempt_id: string | null;
		contact_made: boolean | null;
		attempt_note: string | null;
		attempted_at: string | null;
	}[];
	responses: {
		attempt_id: string;
		turf_location_id: string;
		question_id: string;
		question_text: string;
		question_type: string;
		order_index: number;
		response_value: string;
	}[];
}

/**
 * A turf with its doors, the latest visit at each, and the answers given
 * then, for the turf page. The turf must be on the list, in the bucket with
 * that slug. 404 otherwise, 403 without staff access.
 */
export async function getTurfReport(
	userId: string,
	orgId: string,
	turfId: string,
	listId: string,
	bucketSlug: string
): Promise<TurfReport> {
	await requireActiveMembership(userId, orgId);

	return withOrgTransaction(orgId, async (client) => {
		await requirePermission(client, userId, orgId, 'system.access');

		const turf = await client.query<TurfReport['turf']>(
			`SELECT t.id, t.code, t.expires_at, t.created_at,
			        u.username AS author,
			        s.name AS survey_name,
			        ST_AsGeoJSON(t.bounds)::text AS bounds,
			        l.name AS list_name,
			        b.name AS bucket_name
			   FROM universe.turf t
			   JOIN auth.user u ON t.author_id = u.id
			   LEFT JOIN universe.survey s ON t.survey_id = s.id AND s.org_id = t.org_id
			   JOIN universe.list l ON l.id = t.list_id AND l.org_id = t.org_id
			   JOIN universe.bucket b ON b.id = l.bucket AND b.org_id = t.org_id
			  WHERE t.id = $1 AND t.org_id = $2 AND t.list_id = $3 AND b.slug = $4`,
			[turfId, orgId, listId, bucketSlug]
		);
		if (turf.rows.length === 0) throw error(404, 'Turf not found.');

		const doors = await client.query<TurfReport['locations'][number]>(
			`SELECT tl.id AS turf_location_id,
			        ${nameSql('c')} AS name,
			        ${line1Sql('a')} AS address_line_1,
			        a.locality AS city,
			        a.region AS state_or_region,
			        ST_Y(a.coordinates) AS latitude,
			        ST_X(a.coordinates) AS longitude,
			        tla.id AS attempt_id,
			        tla.contact_made,
			        tla.attempt_note,
			        tla.updated_at AS attempted_at
			   FROM universe.turf_location tl
			   JOIN universe.org_contact c ON c.id = tl.contact_id AND c.org_id = $2
			   JOIN universe.org_address a ON a.id = tl.address_id AND a.org_id = $2
			   LEFT JOIN LATERAL (
			     SELECT id, contact_made, attempt_note, updated_at
			       FROM universe.turf_location_attempt
			      WHERE turf_location_id = tl.id
			      ORDER BY updated_at DESC
			      LIMIT 1
			   ) tla ON true
			  WHERE tl.turf_id = $1 AND tl.org_id = $2
			  ORDER BY name`,
			[turfId, orgId]
		);

		const attemptIds = doors.rows.map((d) => d.attempt_id).filter((id): id is string => !!id);
		let responses: TurfReport['responses'] = [];
		if (attemptIds.length > 0) {
			const result = await client.query<TurfReport['responses'][number]>(
				`SELECT tla.id AS attempt_id, tla.turf_location_id,
				        sq.id AS question_id, sq.question_text, sq.question_type,
				        sq.order_index::int AS order_index,
				        sqr.response_value
				   FROM universe.turf_location_attempt tla
				   JOIN universe.survey_question_response sqr ON sqr.turf_location_attempt_id = tla.id
				   JOIN universe.survey_question sq ON sq.id = sqr.survey_question_id
				  WHERE tla.id = ANY($1) AND tla.org_id = $2
				  ORDER BY tla.turf_location_id, sq.order_index::int`,
				[attemptIds, orgId]
			);
			responses = result.rows;
		}

		return { turf: turf.rows[0], locations: doors.rows, responses };
	});
}
