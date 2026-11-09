import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { withOrgTransaction } from '$lib/server/database';
import { requireOrgPermission, requireSurveyOrg } from '$lib/server/list-access';
import { line1Sql, nameSql } from './contact-columns';

/** Counts and survey results for the staff insight pages. */

/** How many people and locations the organization has now. 404 unless the caller is a member, 403 without staff access. */
export async function getUniverseStats(
	userId: string,
	orgId: string
): Promise<{ people: number; locations: number }> {
	await requireOrgPermission(userId, orgId, 'system.access');

	return withOrgTransaction(orgId, async (client) => {
		const result = await client.query<{ people: string; locations: string }>(
			`SELECT
			   (SELECT COUNT(*) FROM universe.org_person WHERE org_id = $1 AND valid_to IS NULL)::text AS people,
			   (SELECT COUNT(*) FROM universe.org_contact WHERE org_id = $1 AND valid_to IS NULL)::text AS locations`,
			[orgId]
		);
		return {
			people: parseInt(result.rows[0].people, 10),
			locations: parseInt(result.rows[0].locations, 10)
		};
	});
}

const dateString = z
	.string()
	.refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), { message: 'Dates must be in YYYY-MM-DD format.' });

export const SurveyResultsQuerySchema = z.object({
	bucketId: z.string().uuid('Invalid bucket ID.'),
	startDate: dateString.nullable().optional(),
	endDate: dateString.nullable().optional()
});

export type SurveyResultsQuery = z.infer<typeof SurveyResultsQuerySchema>;

export interface SurveyResultLocation {
	id: string;
	name: string | null;
	address_line_1: string | null;
	city: string | null;
	latitude: number;
	longitude: number;
	questions: {
		id: string;
		text: string;
		type: string;
		choices: string[];
		orderIndex: number;
		responses: { value: string; respondedAt: string; respondedBy: string | null }[];
	}[];
}

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
 * The answers to a survey on turfs cut from a bucket's lists, grouped by door
 * and question, for the results map. Each door shows the location as its turf
 * recorded it. 404 when the survey or bucket is in none of the caller's orgs,
 * 403 without `response.read`.
 */
export async function getSurveyResults(
	userId: string,
	surveyId: string,
	query: SurveyResultsQuery
): Promise<SurveyResultLocation[]> {
	const orgId = await requireSurveyOrg(userId, surveyId);
	await requireOrgPermission(userId, orgId, 'response.read');

	return withOrgTransaction(orgId, async (client) => {
		const bucket = await client.query(
			`SELECT 1 FROM universe.bucket WHERE id = $1 AND org_id = $2`,
			[query.bucketId, orgId]
		);
		if (bucket.rowCount === 0) throw error(404, 'Bucket not found.');

		const result = await client.query<ResponseRow>(
			`SELECT
				'org:' || tl.contact_id AS location_key,
				${nameSql('c')} AS name,
				${line1Sql('a')} AS address_line_1,
				a.locality AS city,
				ST_Y(a.coordinates) AS latitude,
				ST_X(a.coordinates) AS longitude,
				sq.id AS question_id,
				sq.question_text,
				sq.question_type,
				sq.choices,
				sq.order_index::int AS order_index,
				sqr.response_value,
				sqr.created_at AS responded_at,
				u.username AS responded_by
			FROM universe.turf t
			JOIN universe.list l ON l.id = t.list_id AND l.org_id = t.org_id
			JOIN universe.turf_location tl ON tl.turf_id = t.id AND tl.org_id = t.org_id
			JOIN universe.org_contact c ON c.id = tl.contact_id AND c.org_id = t.org_id
			JOIN universe.org_address a ON a.id = tl.address_id AND a.org_id = t.org_id
			JOIN universe.turf_location_attempt tla
				ON tla.turf_location_id = tl.id AND tla.org_id = t.org_id
			JOIN universe.survey_question_response sqr
				ON sqr.turf_location_attempt_id = tla.id AND sqr.org_id = t.org_id
			JOIN universe.survey_question sq ON sq.id = sqr.survey_question_id AND sq.org_id = t.org_id
			LEFT JOIN auth."user" u ON u.id = tla.user_id
			WHERE t.org_id = $1
				AND l.bucket = $2
				AND t.survey_id = $3
				AND ($4::date IS NULL OR sqr.created_at::date >= $4::date)
				AND ($5::date IS NULL OR sqr.created_at::date <= $5::date)
			ORDER BY name, sq.order_index::int, sqr.created_at DESC`,
			[orgId, query.bucketId, surveyId, query.startDate ?? null, query.endDate ?? null]
		);

		const locations = new Map<
			string,
			Omit<SurveyResultLocation, 'questions'> & {
				questions: Map<string, SurveyResultLocation['questions'][number]>;
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

		return Array.from(locations.values()).map((location) => ({
			...location,
			questions: Array.from(location.questions.values()).sort((a, b) => a.orderIndex - b.orderIndex)
		}));
	});
}
