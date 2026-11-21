import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { error } from '@sveltejs/kit';
import { getSurveyResults, SurveyResultsQuerySchema } from '$lib/server/services/insights.service';

/**
 * The answers to a survey on the turfs cut from a bucket's lists, grouped by
 * door and question, for the results map.
 *
 * @auth staff
 * @permission response.read
 * @query bucketId {string} - Required. The bucket
 * @query startDate, endDate {string} - Optional. YYYY-MM-DD, inclusive
 * @returns `Array<{ id, name, address_line_1, city, latitude, longitude, questions: Array<{ id, text, type, choices, orderIndex, responses: Array<{ value, respondedAt, respondedBy }> }> }>`. 400 for an invalid id or query, 401 when signed out, 403 without `response.read`, 404 when the survey or bucket is in none of the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const userId = requireUser(locals);
	const surveyId = parseId(params.survey_id, 'survey');
	const query = SurveyResultsQuerySchema.safeParse({
		bucketId: url.searchParams.get('bucketId'),
		startDate: url.searchParams.get('startDate'),
		endDate: url.searchParams.get('endDate')
	});
	if (!query.success) throw error(400, query.error.issues[0]?.message ?? 'Invalid query');

	return json(await getSurveyResults(userId, surveyId, query.data));
};
