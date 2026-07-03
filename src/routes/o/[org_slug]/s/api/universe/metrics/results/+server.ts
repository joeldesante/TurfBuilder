import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers';

const dateString = z
	.string()
	.refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), { message: 'Dates must be in YYYY-MM-DD format.' });

const QuerySchema = z.object({
	bucketId: z.string().uuid('Invalid bucket ID.'),
	surveyId: z.string().uuid('Invalid survey ID.'),
	startDate: dateString.nullable().optional(),
	endDate: dateString.nullable().optional()
});

interface ResponseRow {
	location_key: string;
	name: string | null;
	address_line_1: string | null;
	city: string | null;
	latitude: number | null;
	longitude: number | null;
	question_id: string;
	question_text: string;
	question_type: string;
	choices: string[];
	order_index: number;
	response_value: string | null;
	responded_at: string;
	responded_by: string | null;
}

/**
 * Returns survey responses recorded against a bucket + survey combination,
 * grouped by location and question, for display on the metrics results map.
 *
 * @auth staff
 * @permission response:read
 * @query bucketId {string} required - bucket UUID
 * @query surveyId {string} required - survey UUID
 * @query startDate {string} optional - YYYY-MM-DD, inclusive lower bound
 * @query endDate {string} optional - YYYY-MM-DD, inclusive upper bound
 * @returns Array of locations, each with a nested array of questions and their responses
 */
export async function GET({ locals, url }) {
	if (!locals.organization?.role) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!can(locals.organization, 'response', 'read')) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const parsed = QuerySchema.safeParse({
		bucketId: url.searchParams.get('bucketId'),
		surveyId: url.searchParams.get('surveyId'),
		startDate: url.searchParams.get('startDate'),
		endDate: url.searchParams.get('endDate')
	});
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 });
	}
	const { bucketId, surveyId, startDate, endDate } = parsed.data;

	try {
		return await withOrgTransaction(locals.organization.id, async (client) => {
			const bucketCheck = await client.query(
				`SELECT id FROM universe.bucket WHERE id = $1 AND org_id = $2`,
				[bucketId, locals.organization!.id]
			);
			if (bucketCheck.rows.length === 0) {
				return json({ error: 'Bucket not found.' }, { status: 404 });
			}

			const surveyCheck = await client.query(
				`SELECT id FROM universe.survey WHERE id = $1 AND org_id = $2`,
				[surveyId, locals.organization!.id]
			);
			if (surveyCheck.rows.length === 0) {
				return json({ error: 'Survey not found.' }, { status: 404 });
			}

			const result = await client.query<ResponseRow>(
				`SELECT
					CASE
						WHEN tl.public_location_id IS NOT NULL THEN 'public:' || tl.public_location_id
						ELSE 'org:' || tl.org_location_id
					END AS location_key,
					COALESCE(pl.name, ol.name) AS name,
					COALESCE(pl.address_line_1, ol.address_line_1) AS address_line_1,
					COALESCE(pl.city, ol.city) AS city,
					ST_Y(COALESCE(pl.coordinates, ol.coordinates)) AS latitude,
					ST_X(COALESCE(pl.coordinates, ol.coordinates)) AS longitude,
					sq.id AS question_id,
					sq.question_text,
					sq.question_type,
					sq.choices,
					sq.order_index::int AS order_index,
					sqr.response_value,
					sqr.created_at AS responded_at,
					u.username AS responded_by
				FROM universe.turf t
				JOIN universe.list l ON l.id = t.list_id
				JOIN universe.turf_location tl ON tl.turf_id = t.id
				JOIN universe.turf_location_attempt tla ON tla.turf_location_id = tl.id
				JOIN universe.survey_question_response sqr ON sqr.turf_location_attempt_id = tla.id
				JOIN universe.survey_question sq ON sq.id = sqr.survey_question_id
				LEFT JOIN auth."user" u ON u.id = tla.user_id
				LEFT JOIN universe.public_location pl ON pl.id = tl.public_location_id
				LEFT JOIN universe.org_location ol ON ol.id = tl.org_location_id
				WHERE t.org_id = $1
					AND l.bucket = $2
					AND t.survey_id = $3
					AND ($4::date IS NULL OR sqr.created_at::date >= $4::date)
					AND ($5::date IS NULL OR sqr.created_at::date <= $5::date)
				ORDER BY name, sq.order_index::int, sqr.created_at DESC`,
				[locals.organization!.id, bucketId, surveyId, startDate ?? null, endDate ?? null]
			);

			const locations = new Map<
				string,
				{
					id: string;
					name: string | null;
					address_line_1: string | null;
					city: string | null;
					latitude: number;
					longitude: number;
					questions: Map<
						string,
						{
							id: string;
							text: string;
							type: string;
							choices: string[];
							orderIndex: number;
							responses: { value: string; respondedAt: string; respondedBy: string | null }[];
						}
					>;
				}
			>();

			for (const row of result.rows) {
				if (row.latitude === null || row.longitude === null) continue;

				let location = locations.get(row.location_key);
				if (!location) {
					location = {
						id: row.location_key,
						name: row.name,
						address_line_1: row.address_line_1,
						city: row.city,
						latitude: row.latitude,
						longitude: row.longitude,
						questions: new Map()
					};
					locations.set(row.location_key, location);
				}

				let question = location.questions.get(row.question_id);
				if (!question) {
					question = {
						id: row.question_id,
						text: row.question_text,
						type: row.question_type,
						choices: row.choices,
						orderIndex: row.order_index,
						responses: []
					};
					location.questions.set(row.question_id, question);
				}

				if (row.response_value !== null) {
					question.responses.push({
						value: row.response_value,
						respondedAt: row.responded_at,
						respondedBy: row.responded_by
					});
				}
			}

			return json(
				Array.from(locations.values()).map((location) => ({
					...location,
					questions: Array.from(location.questions.values()).sort(
						(a, b) => a.orderIndex - b.orderIndex
					)
				}))
			);
		});
	} catch (err) {
		console.error('Error fetching metrics results:', err);
		return json({ error: 'Failed to fetch metrics results' }, { status: 500 });
	}
}
