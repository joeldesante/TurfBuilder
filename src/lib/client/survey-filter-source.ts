export interface SourceBucket {
	id: string;
	name: string;
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

/** Where the survey response filter finds the buckets, surveys, and questions to choose from. */
export interface SurveyFilterSource {
	listBuckets(): Promise<SourceBucket[]>;
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
	if (!res.ok) throw new Error('The survey choices could not be loaded.');
	return res.json();
}

/** The source backed by the /api/v1 routes, for one organization. */
export function createSurveyFilterSource(orgId: string): SurveyFilterSource {
	return {
		listBuckets: () => getJson(`/api/v1/organizations/${orgId}/buckets`),
		listSurveys: (bucketId) => getJson(`/api/v1/buckets/${bucketId}/surveys`),
		listQuestions: (surveyId) => getJson(`/api/v1/surveys/${surveyId}/questions`)
	};
}
