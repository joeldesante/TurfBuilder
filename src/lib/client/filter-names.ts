import type { Filter, ContactMadeValue, SurveyResponseValue } from '$lib/shared/types/filters';
import type { SentenceNames } from '$lib/shared/utils/filter-sentence';
import type { FilterSource } from './filter-source';

/** The first row with this id, or undefined. A lookup that fails reads as not found. */
async function find<T extends { id: string }>(
	load: () => Promise<T[]>,
	id: string | null | undefined
): Promise<T | undefined> {
	if (!id) return undefined;
	try {
		return (await load()).find((row) => row.id === id);
	} catch {
		return undefined;
	}
}

/**
 * The names behind the ids in a filter's value, for its sentence. A filter
 * stores ids only, so the names come from the same source the pickers use.
 * Anything that cannot be found is left out and reads generically.
 */
export async function resolveSentenceNames(
	source: FilterSource,
	filter: Filter
): Promise<SentenceNames> {
	const value = filter.value as Partial<ContactMadeValue & SurveyResponseValue> | null;
	if (!value || typeof value !== 'object') return {};

	const names: SentenceNames = {};

	if (filter.item === 'contact_made') {
		const bucket = await find(() => source.listBuckets(), value.bucketId);
		if (bucket) names.bucket = bucket.name;
		if (bucket) {
			const list = await find(() => source.listLists(bucket.id), value.listId);
			if (list) names.list = list.name;
		}
	}

	if (filter.item === 'survey_question_response') {
		const survey = await find(() => source.listSurveys(value.bucketId ?? ''), value.surveyId);
		if (survey) names.survey = survey.name;
		const question = await find(() => source.listQuestions(value.surveyId ?? ''), value.questionId);
		if (question) names.question = question.question_text;
	}

	return names;
}
