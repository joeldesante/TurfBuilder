import { error } from '@sveltejs/kit';
import { withOrgTransaction } from '$lib/server/database.js';
import { can } from '$lib/auth-helpers.js';

export async function load({ locals, url }) {
	if (!can(locals.organization, 'response', 'read')) throw error(403, 'Forbidden.');
	const code = url.searchParams.get('code')?.toUpperCase() ?? null;

	if (!code) {
		return { code: null, results: null, error: null };
	}

	return withOrgTransaction(locals.organization!.id, async (client) => {
		const turfResult = await client.query(
			`SELECT id, survey_id FROM turf WHERE code = $1 AND organization_id = $2`,
			[code, locals.organization!.id]
		);

		if (turfResult.rows.length === 0) {
			return { code, results: null, error: 'No turf found with that code.' };
		}

		const turf = turfResult.rows[0];

		const rows = await client.query(
			`SELECT
				sq.id AS question_id,
				sq.question_text,
				sq.question_type,
				sq.choices,
				sq.order_index,
				sqr.response_value,
				COALESCE(l.street, ol.street) AS street,
				COALESCE(l.locality, ol.locality) AS locality,
				u.username AS user_name
			FROM turf t
			JOIN survey_question sq ON sq.survey_id = t.survey_id
			LEFT JOIN turf_location tl ON tl.turf_id = t.id
			LEFT JOIN turf_location_attempt tla ON tla.turf_location_id = tl.id
			LEFT JOIN survey_question_response sqr
				ON sqr.survey_question_id = sq.id
				AND sqr.turf_location_attempt_id = tla.id
			LEFT JOIN location l ON l.id = tl.location_id
			LEFT JOIN org_location ol ON ol.id = tl.org_location_id
			LEFT JOIN auth."user" u ON u.id = tla.user_id
			WHERE t.code = $1
			ORDER BY sq.order_index ASC, COALESCE(l.street, ol.street) ASC`,
			[code]
		);

		type QuestionGroup = {
			question_id: string;
			question_text: string;
			question_type: string;
			choices: string[];
			order_index: number;
			responses: { response_value: string | null; street: string | null; locality: string | null; user_name: string | null }[];
		};

		const grouped = new Map<string, QuestionGroup>();
		for (const row of rows.rows) {
			if (!grouped.has(row.question_id)) {
				grouped.set(row.question_id, {
					question_id: row.question_id,
					question_text: row.question_text,
					question_type: row.question_type,
					choices: row.choices,
					order_index: row.order_index,
					responses: []
				});
			}
			if (row.response_value !== null) {
				grouped.get(row.question_id)!.responses.push({
					response_value: row.response_value,
					street: row.street,
					locality: row.locality,
					user_name: row.user_name
				});
			}
		}

		const results = Array.from(grouped.values()).sort((a, b) => a.order_index - b.order_index);

		return { code, turf_id: turf.id, results, error: null };
	});
}
