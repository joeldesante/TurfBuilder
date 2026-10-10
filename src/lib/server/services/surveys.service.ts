import { error } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { withOrgTransaction } from '$lib/server/database';
import { requireBucketOrg, requireSurveyOrg } from '$lib/server/list-access';
import { canOrg } from '$lib/server/permissions';

export interface Survey {
	id: string;
	bucket_id: string;
	name: string;
	description: string | null;
}

export interface SurveyInput {
	name: string;
	description?: string | null;
}

export interface QuestionInput {
	/** Present to update an existing question; absent to create one. */
	id?: string;
	question_text: string;
	question_type: 'text' | 'radio' | 'check';
	choices: string[];
}

export interface SurveyQuestion {
	id: string;
	survey_id: string;
	question_text: string;
	/** `text`, `radio` (choose one), or `check` (choose many). */
	question_type: string;
	order_index: number;
	choices: string[];
}

// There are no survey.* keys for the universe surveys yet, so they use the same
// staff check as buckets.
const PERMISSION = 'system.access';

const SURVEY_COLUMNS = 'id, bucket_id, name, description';
const QUESTION_COLUMNS =
	'id, survey_id, question_text, question_type, order_index, choices';

async function requireStaff(client: PoolClient, userId: string, orgId: string) {
	if (!(await canOrg(client, userId, orgId, PERMISSION))) throw error(403, 'Forbidden');
}

/** The surveys in a bucket, by name. 404 when it is in none of the caller's orgs, 403 without staff access. */
export async function listBucketSurveys(userId: string, bucketId: string): Promise<Survey[]> {
	const orgId = await requireBucketOrg(userId, bucketId);

	return withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		const result = await client.query<Survey>(
			`SELECT ${SURVEY_COLUMNS}
			 FROM universe.survey
			 WHERE bucket_id = $1 AND org_id = $2
			 ORDER BY name`,
			[bucketId, orgId]
		);
		return result.rows;
	});
}

/** The questions of a survey in display order. 404 when it is in none of the caller's orgs, 403 without staff access. */
export async function listSurveyQuestions(
	userId: string,
	surveyId: string
): Promise<SurveyQuestion[]> {
	const orgId = await requireSurveyOrg(userId, surveyId);

	return withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		const result = await client.query<SurveyQuestion>(
			`SELECT ${QUESTION_COLUMNS}
			 FROM universe.survey_question
			 WHERE survey_id = $1 AND org_id = $2
			 ORDER BY order_index`,
			[surveyId, orgId]
		);
		return result.rows;
	});
}

/** Creates an empty survey in a bucket. 404 when the bucket is in none of the caller's orgs. */
export async function createSurvey(
	userId: string,
	bucketId: string,
	input: SurveyInput
): Promise<Survey> {
	const orgId = await requireBucketOrg(userId, bucketId);

	return withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		const result = await client.query<Survey>(
			`INSERT INTO universe.survey (name, description, bucket_id, org_id)
			 VALUES ($1, $2, $3, $4)
			 RETURNING ${SURVEY_COLUMNS}`,
			[input.name, input.description ?? null, bucketId, orgId]
		);
		return result.rows[0];
	});
}

/** One survey. 404 when it is in none of the caller's orgs. */
export async function getSurvey(userId: string, surveyId: string): Promise<Survey> {
	const orgId = await requireSurveyOrg(userId, surveyId);

	return withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		const result = await client.query<Survey>(
			`SELECT ${SURVEY_COLUMNS} FROM universe.survey WHERE id = $1 AND org_id = $2`,
			[surveyId, orgId]
		);
		if (result.rowCount === 0) throw error(404, 'Survey not found');
		return result.rows[0];
	});
}

/** Replaces a survey's name and description; an omitted description is cleared. */
export async function replaceSurvey(
	userId: string,
	surveyId: string,
	input: SurveyInput
): Promise<Survey> {
	return updateSurvey(userId, surveyId, { ...input, description: input.description ?? null }, true);
}

/**
 * Updates the given fields of a survey and leaves the rest as they are. Pass
 * `null` as the description to clear it.
 */
export async function updateSurvey(
	userId: string,
	surveyId: string,
	input: Partial<SurveyInput>,
	replaceDescription = false
): Promise<Survey> {
	const orgId = await requireSurveyOrg(userId, surveyId);

	return withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		// COALESCE keeps the stored name; the description is only touched when asked.
		const touchDescription = replaceDescription || input.description !== undefined;
		const result = await client.query<Survey>(
			`UPDATE universe.survey
			 SET name = COALESCE($3, name),
			     description = CASE WHEN $4 THEN $5 ELSE description END,
			     updated_at = now()
			 WHERE id = $1 AND org_id = $2
			 RETURNING ${SURVEY_COLUMNS}`,
			[surveyId, orgId, input.name ?? null, touchDescription, input.description ?? null]
		);
		if (result.rowCount === 0) throw error(404, 'Survey not found');
		return result.rows[0];
	});
}

/**
 * Deletes a survey along with its questions and every response to them. 409
 * while a turf uses it, because the database would delete that turf too.
 */
export async function deleteSurvey(userId: string, surveyId: string): Promise<void> {
	const orgId = await requireSurveyOrg(userId, surveyId);

	await withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		const turfs = await client.query(
			`SELECT 1 FROM universe.turf WHERE survey_id = $1 AND org_id = $2 LIMIT 1`,
			[surveyId, orgId]
		);
		if (turfs.rowCount) throw error(409, 'A turf uses this survey');

		const result = await client.query(
			`DELETE FROM universe.survey WHERE id = $1 AND org_id = $2`,
			[surveyId, orgId]
		);
		if (result.rowCount === 0) throw error(404, 'Survey not found');
	});
}

/**
 * Makes the survey's questions exactly the ones given, in the given order.
 * Questions with an id are updated, those without are created, and any not
 * listed are deleted along with their responses. 400 when an id is not one of
 * the survey's questions.
 */
export async function replaceSurveyQuestions(
	userId: string,
	surveyId: string,
	questions: QuestionInput[]
): Promise<SurveyQuestion[]> {
	const orgId = await requireSurveyOrg(userId, surveyId);

	return withOrgTransaction(orgId, async (client) => {
		await requireStaff(client, userId, orgId);

		const keep = questions.flatMap((q) => (q.id ? [q.id] : []));
		await client.query(
			`DELETE FROM universe.survey_question
			 WHERE survey_id = $1 AND org_id = $2 AND id != ALL($3::uuid[])`,
			[surveyId, orgId, keep]
		);

		for (const [index, q] of questions.entries()) {
			if (q.id) {
				const updated = await client.query(
					`UPDATE universe.survey_question
					 SET question_text = $1, question_type = $2, order_index = $3, choices = $4, updated_at = now()
					 WHERE id = $5 AND survey_id = $6 AND org_id = $7`,
					[q.question_text, q.question_type, index, q.choices, q.id, surveyId, orgId]
				);
				if (updated.rowCount === 0) throw error(400, 'A question does not belong to this survey');
			} else {
				await client.query(
					`INSERT INTO universe.survey_question (question_text, question_type, order_index, choices, survey_id, org_id)
					 VALUES ($1, $2, $3, $4, $5, $6)`,
					[q.question_text, q.question_type, index, q.choices, surveyId, orgId]
				);
			}
		}

		const result = await client.query<SurveyQuestion>(
			`SELECT ${QUESTION_COLUMNS}
			 FROM universe.survey_question
			 WHERE survey_id = $1 AND org_id = $2
			 ORDER BY order_index`,
			[surveyId, orgId]
		);
		return result.rows;
	});
}
