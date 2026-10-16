import type { ContactMadeValue, Filter, SurveyResponseValue } from '$lib/shared/types/filters';
import type { SentenceNames } from '$lib/shared/utils/filter-sentence';

export interface SourceBucket {
	id: string;
	name: string;
}

export interface SourceList {
	id: string;
	name: string;
	entity_type: 'people' | 'locations';
}

export interface SourceSurvey {
	id: string;
	name: string;
}

export interface SourceQuestion {
	id: string;
	question_text: string;
	/** `text`, `radio` (choose one), or `check` (choose many). */
	question_type: string;
	choices: string[];
}

/** Where the filters that name a bucket, list, survey, or question find the choices to offer. */
export interface FilterSource {
	listBuckets(): Promise<SourceBucket[]>;
	listLists(bucketId: string): Promise<SourceList[]>;
	listSurveys(bucketId: string): Promise<SourceSurvey[]>;
	listQuestions(surveyId: string): Promise<SourceQuestion[]>;
}

/** Fetches JSON, failing with a message fit to show the user. */
async function getJson<T>(url: string): Promise<T> {
	let res: Response;
	try {
		res = await fetch(url);
	} catch {
		throw new Error('Could not reach the server. Check your connection and try again.');
	}
	if (!res.ok) throw new Error('The choices could not be loaded.');
	return res.json();
}

/** The source backed by the /api/v1 routes, for one organization. */
export function createFilterSource(orgId: string): FilterSource {
	return {
		listBuckets: () => getJson(`/api/v1/organizations/${orgId}/buckets`),
		listLists: (bucketId) => getJson(`/api/v1/buckets/${bucketId}/lists`),
		listSurveys: (bucketId) => getJson(`/api/v1/buckets/${bucketId}/surveys`),
		listQuestions: (surveyId) => getJson(`/api/v1/surveys/${surveyId}/questions`)
	};
}

/**
 * Loads the options for a picker and hands them over, unless the picker has
 * moved on by the time they arrive. Pass null when there is nothing to ask for
 * yet, which gives no options. A failure gives no options too, and is reported
 * through `setFailed`. Returns a cleanup, so it can be returned straight from an
 * `$effect`.
 */
export function loadOptions<T>(
	fetcher: (() => Promise<T[]>) | null,
	set: (rows: T[]) => void,
	setFailed: (failed: boolean) => void
): () => void {
	let stale = false;
	if (!fetcher) {
		set([]);
		return () => {};
	}
	fetcher().then(
		(rows) => {
			if (stale) return;
			setFailed(false);
			set(rows);
		},
		() => {
			if (stale) return;
			setFailed(true);
			set([]);
		}
	);
	return () => {
		stale = true;
	};
}

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
