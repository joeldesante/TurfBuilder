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
