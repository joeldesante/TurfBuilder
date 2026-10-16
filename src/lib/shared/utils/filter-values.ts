import { parseDate } from '@internationalized/date';
import type { DateValue } from '@internationalized/date';
import type { ContactMadeValue, RadiusValue, SurveyResponseValue } from '../types/filters';
import { defaultContactMade } from './filter-registry';

/**
 * Reads a filter's value, which is `unknown` until it has been filled in, as
 * the type its editor works with. A value that has not been set yet (the empty
 * string a new filter starts with, say) reads as nothing chosen, or as the
 * defaults where the editor can start from those.
 */

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

/** The area of a radius filter, or null until a point and distance are chosen. */
export function asRadius(value: unknown): RadiusValue | null {
	return isObject(value) &&
		typeof value.latitude === 'number' &&
		typeof value.longitude === 'number' &&
		typeof value.radius === 'number'
		? (value as unknown as RadiusValue)
		: null;
}

/** The region of a drawn-region filter, or null until one is drawn. */
export function asPolygon(value: unknown): GeoJSON.Polygon | null {
	return isObject(value) && value.type === 'Polygon' ? (value as unknown as GeoJSON.Polygon) : null;
}

/**
 * The choice of a survey response filter, or null until a bucket is picked.
 * The parts below the bucket read as not chosen yet.
 */
export function asSurveyResponse(value: unknown): SurveyResponseValue | null {
	if (!isObject(value) || typeof value.bucketId !== 'string' || !value.bucketId) return null;
	return {
		bucketId: value.bucketId,
		surveyId: typeof value.surveyId === 'string' ? value.surveyId : '',
		questionId: typeof value.questionId === 'string' ? value.questionId : '',
		response: typeof value.response === 'string' ? value.response : ''
	};
}

/** A contact made filter's value, filled out with the defaults for anything missing or not yet set. */
export function asContactMade(value: unknown): ContactMadeValue {
	return isObject(value) && typeof value.contacted === 'boolean'
		? { ...defaultContactMade(), ...(value as Partial<ContactMadeValue>) }
		: defaultContactMade();
}

/** A date as the date pickers take it, or undefined for nothing or something that is not a date. */
export function asCalendarDate(value: unknown): DateValue | undefined {
	if (typeof value !== 'string' || !value) return undefined;
	try {
		return parseDate(value);
	} catch {
		return undefined;
	}
}
