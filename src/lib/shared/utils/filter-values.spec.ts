import { describe, it, expect } from 'vitest';
import {
	asCalendarDate,
	asContactMade,
	asPolygon,
	asRadius,
	asSurveyResponse
} from './filter-values';
import { defaultContactMade } from './filter-registry';

describe('asRadius', () => {
	it('reads a point and distance', () => {
		const area = { latitude: 40, longitude: -75, radius: 2 };

		expect(asRadius(area)).toEqual(area);
	});

	it.each([[''], [null], [undefined], [5], [{}], [{ latitude: 1, longitude: 2 }], [{ latitude: '1', longitude: 2, radius: 3 }]])(
		'reads %j as nothing chosen',
		(value) => {
			expect(asRadius(value)).toBeNull();
		}
	);
});

describe('asPolygon', () => {
	it('reads a polygon', () => {
		const polygon = { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] };

		expect(asPolygon(polygon)).toEqual(polygon);
	});

	it.each([[''], [null], [{ type: 'Point', coordinates: [0, 0] }], [[]]])('reads %j as nothing drawn', (value) => {
		expect(asPolygon(value)).toBeNull();
	});
});

describe('asSurveyResponse', () => {
	it('reads a complete choice', () => {
		const choice = { bucketId: 'b', surveyId: 's', questionId: 'q', response: 'Yes' };

		expect(asSurveyResponse(choice)).toEqual(choice);
	});

	it('reads the parts below the bucket as not chosen yet', () => {
		expect(asSurveyResponse({ bucketId: 'b' })).toEqual({
			bucketId: 'b',
			surveyId: '',
			questionId: '',
			response: ''
		});
	});

	it.each([[''], [null], [{}], [{ bucketId: '' }], [{ bucketId: 5 }]])('reads %j as no bucket picked', (value) => {
		expect(asSurveyResponse(value)).toBeNull();
	});
});

describe('asContactMade', () => {
	it('keeps what is set', () => {
		const value = { ...defaultContactMade(), contacted: false, position: 'latest' as const };

		expect(asContactMade(value)).toEqual(value);
	});

	it('fills in what is missing from the defaults', () => {
		expect(asContactMade({ contacted: false })).toEqual({ ...defaultContactMade(), contacted: false });
	});

	it.each([[''], [null], [undefined], [true], [{}], [{ contacted: 'yes' }]])('starts from the defaults for %j', (value) => {
		expect(asContactMade(value)).toEqual(defaultContactMade());
	});
});

describe('asCalendarDate', () => {
	it('reads a date', () => {
		expect(asCalendarDate('2026-03-01')?.toString()).toBe('2026-03-01');
	});

	it.each([[''], [null], [undefined], [20260301], ['March'], ['2026-13-45']])('reads %j as no date', (value) => {
		expect(asCalendarDate(value)).toBeUndefined();
	});
});
