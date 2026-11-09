import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { withOrgTransaction } from '$lib/server/database';
import { requireDoorOrg, requireTurfOrg } from '$lib/server/list-access';
import type { LocationEditProposal, LocationFields, LocationPatch } from '$lib/schemas/location';
import { recordEvent } from './activity.service';
import { locationColumns } from './contact-columns';
import {
	createLocationVersion,
	deleteUnreviewedLocation,
	findEditTarget,
	insertEditProposal,
	insertLocation,
	mergeLocationFields,
	readCurrentVersion
} from './locations.service';
import {
	countOpenSuggestions,
	findEditableSuggestion,
	findWritableTurf,
	isInsideTurf,
	MAX_OPEN_SUGGESTIONS
} from './suggestions.service';

/**
 * Canvassing: what a volunteer does on a turf they joined. Volunteers have no
 * staff role, so every gate here is structural: membership of the turf, the
 * turf still being open for additions, and authorship of a suggestion.
 *
 * A turf's doors are a snapshot: each door records the contact version and the
 * address version its list had (`turf_location.contact_id`, `address_id`), and
 * these reads show exactly those, however the location changed since. The one
 * exception is a volunteer's own addition, which they may still correct: its
 * door follows their corrections.
 */

/** Cap on open corrections per canvasser per turf. */
export const MAX_OPEN_EDITS = 25;

/** 403 unless the user has joined the turf. */
async function requireTurfMember(
	client: PoolClient,
	turfId: string,
	userId: string,
	orgId: string,
	message = 'You have not been added to this turf'
): Promise<void> {
	const membership = await client.query(
		`SELECT 1 FROM universe.turf_user WHERE turf_id = $1 AND user_id = $2 AND org_id = $3`,
		[turfId, userId, orgId]
	);
	if (membership.rowCount === 0) throw error(403, message);
}

/** The turf door columns, reading the versions the door recorded. Expects `tl`, `c`, `a`. */
const DOOR_FROM = `
	FROM universe.turf_location tl
	JOIN universe.org_contact c ON c.id = tl.contact_id AND c.org_id = tl.org_id
	JOIN universe.org_address a ON a.id = tl.address_id AND a.org_id = tl.org_id`;

/** 403 unless the caller joined the turf; 404 when it is in none of their orgs. Page loads use it as their guard. */
export async function requireTurfMembership(userId: string, turfId: string): Promise<string> {
	const orgId = await requireTurfOrg(userId, turfId);
	await withOrgTransaction(orgId, (client) => requireTurfMember(client, turfId, userId, orgId));
	return orgId;
}

export interface TurfMapDoor {
	id: string;
	location_name: string;
	latitude: number;
	longitude: number;
	street: string | null;
	street_2: string | null;
	locality: string | null;
	postcode: string | null;
	region: string | null;
	country: string | null;
	entity_id: string;
	is_tentative: boolean;
	is_mine: boolean;
	has_pending_edit: boolean;
	visited: boolean;
	contact_made: boolean | null;
}

export interface TurfMap {
	turfId: string;
	locations: TurfMapDoor[];
	center: { lat: number; lng: number };
	bounds: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
	canSuggest: boolean;
}

/** Most doors drawn on a volunteer's map. */
const MAX_MAP_DOORS = 500;

/** The volunteer's map of a turf: its doors, where to centre, and whether they may add doors. */
export async function getTurfMap(userId: string, turfId: string): Promise<TurfMap> {
	const orgId = await requireTurfOrg(userId, turfId);

	return withOrgTransaction(orgId, async (client) => {
		await requireTurfMember(client, turfId, userId, orgId);

		const turfResult = await client.query<{
			latitude: number | null;
			longitude: number | null;
			bounds_geojson: string | null;
			is_open: boolean;
		}>(
			`SELECT ST_Y(ST_Centroid(bounds)) AS latitude,
			        ST_X(ST_Centroid(bounds)) AS longitude,
			        ST_AsGeoJSON(bounds) AS bounds_geojson,
			        (expires_at IS NULL OR expires_at > now()) AS is_open
			   FROM universe.turf WHERE id = $1 AND org_id = $2`,
			[turfId, orgId]
		);
		const turf = turfResult.rows[0];
		if (!turf) throw error(404, 'Turf not found.');

		const doors = await client.query<TurfMapDoor>(
			`SELECT
			        tl.id,
			        COALESCE(doors.name, '') AS location_name,
			        doors.latitude, doors.longitude,
			        doors.address_line_1 AS street,
			        doors.address_line_2 AS street_2,
			        doors.city AS locality,
			        doors.postal_code AS postcode,
			        doors.state_or_region AS region,
			        doors.country_code AS country,
			        c.entity_id,
			        COALESCE(ls.status = 'tentative', false) AS is_tentative,
			        COALESCE(ls.status = 'tentative' AND ls.user_id = $3, false) AS is_mine,
			        EXISTS (
			          SELECT 1 FROM universe.location_edit_suggestion les
			           WHERE les.turf_location_id = tl.id AND les.user_id = $3 AND les.status = 'pending'
			        ) AS has_pending_edit,
			        EXISTS (
			          SELECT 1 FROM universe.turf_location_attempt tla WHERE tla.turf_location_id = tl.id
			        ) AS visited,
			        (SELECT tla.contact_made FROM universe.turf_location_attempt tla
			          WHERE tla.turf_location_id = tl.id
			          ORDER BY tla.updated_at DESC NULLS LAST LIMIT 1) AS contact_made
			 ${DOOR_FROM}
			 CROSS JOIN LATERAL (SELECT ${locationColumns('c', 'a')}) doors
			 LEFT JOIN universe.location_suggestion ls ON ls.entity_id = c.entity_id AND ls.org_id = tl.org_id
			 WHERE tl.turf_id = $1 AND tl.org_id = $2
			 ORDER BY tl.created_at, tl.id
			 LIMIT ${MAX_MAP_DOORS}`,
			[turfId, orgId, userId]
		);

		const centre = await client.query<{ latitude: number | null; longitude: number | null }>(
			`SELECT ST_Y(ST_Centroid(ST_Collect(a.coordinates))) AS latitude,
			        ST_X(ST_Centroid(ST_Collect(a.coordinates))) AS longitude
			 ${DOOR_FROM}
			 WHERE tl.turf_id = $1 AND tl.org_id = $2`,
			[turfId, orgId]
		);

		// A turf with no doors is a legitimate state (the volunteer can still add
		// one), so the centre falls back to the middle of the turf's bounds.
		const point = centre.rows[0];
		return {
			turfId,
			locations: doors.rows,
			center: {
				lat: Number(point?.latitude ?? turf.latitude ?? 0),
				lng: Number(point?.longitude ?? turf.longitude ?? 0)
			},
			// Drawn on the map so a volunteer can see where a new pin is allowed.
			bounds: turf.bounds_geojson ? JSON.parse(turf.bounds_geojson) : null,
			// Additions are refused once a turf expires; hiding the control keeps that from being a surprise.
			canSuggest: turf.is_open === true
		};
	});
}

export interface DoorStatus {
	id: string;
	visited: boolean;
	contact_made: boolean | null;
}

/** Whether each door on the turf was visited, and the latest outcome. 403 unless the caller joined it. */
export async function listDoorStatuses(userId: string, turfId: string): Promise<DoorStatus[]> {
	const orgId = await requireTurfOrg(userId, turfId);

	return withOrgTransaction(orgId, async (client) => {
		await requireTurfMember(client, turfId, userId, orgId, 'Forbidden');

		const result = await client.query<DoorStatus>(
			`SELECT tl.id,
			        COUNT(tla.id) > 0 AS visited,
			        (array_agg(tla.contact_made ORDER BY tla.updated_at DESC NULLS LAST))[1] AS contact_made
			   FROM universe.turf_location tl
			   LEFT JOIN universe.turf_location_attempt tla ON tla.turf_location_id = tl.id
			  WHERE tl.turf_id = $1 AND tl.org_id = $2
			  GROUP BY tl.id`,
			[turfId, orgId]
		);
		return result.rows;
	});
}

export interface DoorPage {
	turfId: string;
	/** Blank, not null, where the door has no value: the survey screen shows them as text. */
	location: {
		location_name: string;
		street: string;
		locality: string;
		postcode: string;
		region: string;
	};
	scriptContents: string | null;
	existingContactMade: boolean | null;
	existingAttemptNote: string;
	surveyId: string | null;
	questions: {
		id: string;
		question_text: string;
		question_type: string;
		order_index: number;
		choices: string[];
	}[];
	responses: { survey_question_id: string; response_value: string }[];
}

/** One door's survey screen for the caller: the door, the turf's survey and script, and what they recorded so far. */
export async function getDoor(userId: string, doorId: string): Promise<DoorPage> {
	const { orgId, turfId } = await requireDoorOrg(userId, doorId);

	return withOrgTransaction(orgId, async (client) => {
		await requireTurfMember(client, turfId, userId, orgId);

		const doorResult = await client.query<{
			survey_id: string | null;
			script_contents: string | null;
			location_name: string;
			street: string;
			locality: string;
			postcode: string;
			region: string;
		}>(
			`SELECT t.survey_id, sc.contents AS script_contents,
			        COALESCE(doors.name, '') AS location_name,
			        COALESCE(doors.address_line_1, '') AS street,
			        COALESCE(doors.city, '') AS locality,
			        COALESCE(doors.postal_code, '') AS postcode,
			        COALESCE(doors.state_or_region, '') AS region
			 ${DOOR_FROM}
			 CROSS JOIN LATERAL (SELECT ${locationColumns('c', 'a')}) doors
			 JOIN universe.turf t ON t.id = tl.turf_id AND t.org_id = tl.org_id
			 LEFT JOIN universe.script sc ON sc.id = t.script_id AND sc.org_id = t.org_id
			 WHERE tl.id = $1 AND tl.org_id = $2`,
			[doorId, orgId]
		);
		const door = doorResult.rows[0];
		if (!door) throw error(404, 'Location not found in this turf.');
		const { survey_id: surveyId, script_contents: scriptContents, ...location } = door;

		const questions = await client.query<DoorPage['questions'][number]>(
			`SELECT id, question_text, question_type, order_index, choices
			   FROM universe.survey_question
			  WHERE survey_id = $1 AND org_id = $2
			  ORDER BY order_index ASC`,
			[surveyId, orgId]
		);

		// Only read: an attempt is made when the canvasser picks an outcome and saves.
		const attempt = await client.query<{
			id: string;
			contact_made: boolean | null;
			attempt_note: string | null;
		}>(
			`SELECT id, contact_made, attempt_note
			   FROM universe.turf_location_attempt
			  WHERE turf_location_id = $1 AND user_id = $2 AND org_id = $3`,
			[doorId, userId, orgId]
		);
		const existing = attempt.rows[0] ?? null;

		let responses: DoorPage['responses'] = [];
		if (existing && questions.rows.length > 0) {
			const result = await client.query<DoorPage['responses'][number]>(
				`SELECT survey_question_id, response_value
				   FROM universe.survey_question_response
				  WHERE turf_location_attempt_id = $1 AND org_id = $2 AND survey_question_id = ANY($3)`,
				[existing.id, orgId, questions.rows.map((q) => q.id)]
			);
			responses = result.rows;
		}

		return {
			turfId,
			location,
			scriptContents: scriptContents ?? null,
			existingContactMade: existing ? existing.contact_made : null,
			existingAttemptNote: existing?.attempt_note ?? '',
			surveyId,
			questions: questions.rows,
			responses
		};
	});
}

export const VisitSchema = z.object({
	contactStatus: z.enum(['no_contact', 'contacted']),
	attemptNote: z.string().default('').optional(),
	questions: z.array(
		z.object({
			db_id: z.string().uuid(),
			type: z.string().optional(),
			text: z.string().optional(),
			choices: z.array(z.string()).optional(),
			index: z.number().optional(),
			response: z.string()
		})
	)
});

export type VisitInput = z.infer<typeof VisitSchema>;

/**
 * Records the caller's visit to a door, replacing their earlier one there, and
 * the survey answers when someone answered. 403 unless they joined the turf.
 */
export async function recordVisit(
	userId: string,
	doorId: string,
	visit: VisitInput
): Promise<void> {
	const { orgId, turfId } = await requireDoorOrg(userId, doorId);
	const contactMade = visit.contactStatus === 'contacted';

	const attemptId = await withOrgTransaction(orgId, async (client) => {
		await requireTurfMember(
			client,
			turfId,
			userId,
			orgId,
			'User must be a turf user to make a location attempt.'
		);

		const attempt = await client.query<{ id: string }>(
			`INSERT INTO universe.turf_location_attempt (turf_location_id, user_id, org_id, contact_made, attempt_note)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (turf_location_id, user_id)
			 DO UPDATE SET contact_made = $4, attempt_note = $5, updated_at = NOW()
			 RETURNING id`,
			[doorId, userId, orgId, contactMade, visit.attemptNote ?? '']
		);
		const id = attempt.rows[0].id;

		if (contactMade) {
			for (const question of visit.questions) {
				await client.query(
					`INSERT INTO universe.survey_question_response (response_value, survey_question_id, turf_location_attempt_id, org_id)
					 SELECT $1, sq.id, $3, $4 FROM universe.survey_question sq WHERE sq.id = $2 AND sq.org_id = $4
					 ON CONFLICT (survey_question_id, turf_location_attempt_id)
					 DO UPDATE SET response_value = $1, updated_at = NOW()`,
					[question.response, question.db_id, id, orgId]
				);
			}
		}
		return id;
	});

	// Keyed by attempt, so revisiting a door updates nothing here: the first
	// visit is the one that counts.
	await recordEvent('canvass.visit', {
		userId,
		orgId,
		metadata: { contact_made: contactMade },
		sourceKey: `canvass.visit:${attemptId}`
	});
	if (contactMade && visit.questions.length > 0) {
		await recordEvent('survey.submitted', {
			userId,
			orgId,
			sourceKey: `survey.submitted:${attemptId}`
		});
	}
}

/**
 * Adds a door a volunteer found that was not on the turf. The location is
 * tentative (staff approve it) and goes straight onto the turf, so the
 * volunteer can knock it now, though it stays out of buckets, lists, and
 * future turfs until approved. 403 when the turf is closed or the caller is
 * not on it, 422 for a pin outside the turf, 429 past the cap on open additions.
 */
export async function suggestLocation(
	userId: string,
	turfId: string,
	fields: LocationFields
): Promise<{ turf_location_id: string; entity_id: string }> {
	const orgId = await requireTurfOrg(userId, turfId);

	return withOrgTransaction(orgId, async (client) => {
		if (!(await findWritableTurf(client, turfId, userId, orgId))) {
			throw error(403, 'This turf is closed or you are no longer assigned to it.');
		}
		if (!(await isInsideTurf(client, turfId, orgId, fields.latitude, fields.longitude))) {
			throw error(422, 'Pin must be inside your turf.');
		}
		if ((await countOpenSuggestions(client, turfId, userId, orgId)) >= MAX_OPEN_SUGGESTIONS) {
			throw error(429, 'You have too many locations awaiting review on this turf.');
		}

		const location = await insertLocation(
			client,
			orgId,
			fields,
			userId,
			'volunteer_suggestion',
			'volunteer_suggestion'
		);

		await client.query(
			`INSERT INTO universe.location_suggestion (org_id, entity_id, turf_id, user_id, status)
			 VALUES ($1, $2, $3, $4, 'tentative')`,
			[orgId, location.entityId, turfId, userId]
		);

		const door = await client.query<{ id: string }>(
			`INSERT INTO universe.turf_location (org_id, turf_id, contact_id, address_id)
			 VALUES ($1, $2, $3, $4)
			 RETURNING id`,
			[orgId, turfId, location.versionId, location.addressId]
		);

		return { turf_location_id: door.rows[0].id, entity_id: location.entityId };
	});
}

const LOCKED =
	'This addition can no longer be changed. It has been reviewed, or your turf has closed.';

/**
 * Corrects a door the volunteer added, while it is theirs, still tentative,
 * and the turf is open. The correction is a new version, and the door on the
 * turf follows it. 403 when locked, 422 for a pin moved outside the turf.
 */
export async function updateSuggestedLocation(
	userId: string,
	turfId: string,
	entityId: string,
	patch: LocationPatch
): Promise<{ entity_id: string; id: string }> {
	const orgId = await requireTurfOrg(userId, turfId);

	return withOrgTransaction(orgId, async (client) => {
		if (!(await findEditableSuggestion(client, entityId, turfId, userId, orgId))) {
			throw error(403, LOCKED);
		}

		const current = await readCurrentVersion(client, orgId, entityId);
		if (!current) throw error(404, 'Location not found.');

		const merged = mergeLocationFields(current, patch);
		const moved = merged.latitude !== current.latitude || merged.longitude !== current.longitude;
		if (moved && !(await isInsideTurf(client, turfId, orgId, merged.latitude, merged.longitude))) {
			throw error(422, 'Pin must be inside your turf.');
		}

		const version = await createLocationVersion(
			client,
			orgId,
			entityId,
			merged,
			userId,
			'volunteer_suggestion'
		);
		if (!version) throw error(404, 'Location not found.');

		// The volunteer's own draft: its door shows what they typed last. The door
		// is found by entity, not by the version just replaced: staff may have
		// edited the addition since, which leaves the door on an earlier version.
		await client.query(
			`UPDATE universe.turf_location SET contact_id = $1, address_id = $2
			  WHERE turf_id = $3 AND org_id = $4
			    AND contact_id IN (
			      SELECT id FROM universe.org_contact WHERE entity_id = $5 AND org_id = $4)`,
			[version.versionId, version.addressId, turfId, orgId, entityId]
		);

		return { entity_id: entityId, id: version.versionId };
	});
}

/**
 * Withdraws a door the volunteer added by mistake, under the same conditions
 * as correcting it. A hard delete, unlike the staff soft delete: an unreviewed
 * addition has no history worth keeping, and its door, visit, and answers go
 * with it.
 */
export async function withdrawSuggestedLocation(
	userId: string,
	turfId: string,
	entityId: string
): Promise<void> {
	const orgId = await requireTurfOrg(userId, turfId);

	await withOrgTransaction(orgId, async (client) => {
		if (!(await findEditableSuggestion(client, entityId, turfId, userId, orgId))) {
			throw error(403, LOCKED);
		}
		await deleteUnreviewedLocation(client, orgId, entityId);
	});
}

/**
 * Proposes a correction to a door whose record is wrong. It is parked for
 * staff review rather than applied, since the location is part of the
 * official dataset. 400 for a correction with nothing in it, 403 when the turf
 * is closed or the caller is not on it, 422 for a pin outside the turf, 429
 * past the cap on open corrections.
 */
export async function proposeLocationEdit(
	userId: string,
	doorId: string,
	proposal: LocationEditProposal
): Promise<{ id: string }> {
	const hasChange = [
		proposal.name,
		proposal.address_line_1,
		proposal.address_line_2,
		proposal.address_line_3,
		proposal.city,
		proposal.state_or_region,
		proposal.postal_code,
		proposal.country_code,
		proposal.latitude,
		proposal.note
	].some((v) => v !== undefined && v !== null && v !== '');
	if (!hasChange && (proposal.photo_keys?.length ?? 0) === 0) {
		throw error(400, 'Describe what is wrong before sending a correction.');
	}

	const { orgId, turfId } = await requireDoorOrg(userId, doorId);

	return withOrgTransaction(orgId, async (client) => {
		if (!(await findWritableTurf(client, turfId, userId, orgId))) {
			throw error(403, 'This turf is closed or you are no longer assigned to it.');
		}

		const target = await findEditTarget(client, doorId, turfId, orgId);
		if (!target) throw error(404, 'Location not found in this turf.');

		if (
			proposal.latitude !== undefined &&
			proposal.longitude !== undefined &&
			!(await isInsideTurf(client, turfId, orgId, proposal.latitude, proposal.longitude))
		) {
			throw error(422, 'Pin must be inside your turf.');
		}

		const open = await client.query<{ n: number }>(
			`SELECT count(*)::int AS n FROM universe.location_edit_suggestion
			  WHERE turf_id = $1 AND user_id = $2 AND org_id = $3 AND status = 'pending'`,
			[turfId, userId, orgId]
		);
		if ((open.rows[0]?.n ?? 0) >= MAX_OPEN_EDITS) {
			throw error(429, 'You have too many corrections awaiting review on this turf.');
		}

		return { id: await insertEditProposal(client, orgId, target, turfId, userId, proposal) };
	});
}
