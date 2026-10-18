import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import {
	deleteSurvey,
	getSurvey,
	replaceSurvey,
	updateSurvey
} from '$lib/server/services/surveys.service';

const putSchema = z.object({
	name: z.string().trim().min(1).max(255),
	description: z.string().max(2000).nullable().optional()
});

const patchSchema = putSchema.partial();

/**
 * One survey.
 *
 * @auth staff
 * @returns `{ id, bucket_id, name, description }`. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const surveyId = parseId(params.survey_id, 'survey');

	return json(await getSurvey(userId, surveyId));
};

/**
 * Replaces a survey's name and description. The name is required; an omitted description is cleared.
 *
 * @auth staff
 * @body name {string} - Display name, 1 to 255 characters
 * @body description {string|null} - Optional, at most 2000 characters
 * @returns The survey. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const surveyId = parseId(params.survey_id, 'survey');

	const body = putSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, body.error.issues[0].message);

	return json(await replaceSurvey(userId, surveyId, body.data));
};

/**
 * Updates the given fields of a survey and leaves the rest as they are.
 *
 * @auth staff
 * @body name {string} - Optional. Display name, 1 to 255 characters
 * @body description {string|null} - Optional. Null clears it
 * @returns The survey. 400 for an invalid id or body, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const surveyId = parseId(params.survey_id, 'survey');

	const body = patchSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, body.error.issues[0].message);

	return json(await updateSurvey(userId, surveyId, body.data));
};

/**
 * Deletes a survey with its questions and all responses to them.
 *
 * @auth staff
 * @returns 204 No Content. 400 for an invalid id, 401 when signed out, 403 without staff access, 404 when it is not in the caller's organizations, 409 while a turf uses the survey
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const userId = requireUser(locals);
	const surveyId = parseId(params.survey_id, 'survey');

	await deleteSurvey(userId, surveyId);

	return new Response(null, { status: 204 });
};
