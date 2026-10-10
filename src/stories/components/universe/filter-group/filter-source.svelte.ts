import { getContext, setContext } from 'svelte';
import type { SurveyFilterSource } from '$lib/client/survey-filter-source';

export const SURVEY_SOURCE_KEY = Symbol('filter-survey-source');

/** Lets filter rows deep in a query load survey choices without every group passing the source down. */
export function provideSurveyFilterSource(source: SurveyFilterSource) {
	setContext(SURVEY_SOURCE_KEY, source);
}

export function useSurveyFilterSource(): SurveyFilterSource | undefined {
	return getContext<SurveyFilterSource | undefined>(SURVEY_SOURCE_KEY);
}
