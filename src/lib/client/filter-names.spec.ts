import { describe, it, expect, vi } from 'vitest';
import { resolveSentenceNames } from './filter-names';
import type { FilterSource } from './filter-source';
import { defaultContactMade } from '$lib/shared/utils/filter-registry';

const B = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const L = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const S = 'd1b2c3d4-e5f6-7890-abcd-ef1234567890';
const Q = 'e1b2c3d4-e5f6-7890-abcd-ef1234567890';

function makeSource(overrides: Partial<FilterSource> = {}): FilterSource {
	return {
		listBuckets: vi.fn(async () => [{ id: B, name: 'Voters' }]),
		listLists: vi.fn(async () => [{ id: L, name: 'Ward 3', entity_type: 'locations' as const }]),
		listSurveys: vi.fn(async () => [{ id: S, name: 'Spring canvass' }]),
		listQuestions: vi.fn(async () => [
			{ id: Q, question_text: 'Vote for it?', question_type: 'radio', choices: [] }
		]),
		...overrides
	};
}

const contact = (change = {}) => ({
	item: 'contact_made',
	operation: 'equals' as const,
	value: { ...defaultContactMade(), ...change }
});

describe('resolveSentenceNames', () => {
	it('names the bucket and list of a contact made filter', async () => {
		const source = makeSource();

		const names = await resolveSentenceNames(source, contact({ bucketId: B, listId: L }));

		expect(names).toEqual({ bucket: 'Voters', list: 'Ward 3' });
		expect(source.listLists).toHaveBeenCalledWith(B);
	});

	it('asks for nothing when the filter names no bucket or list', async () => {
		const source = makeSource();

		expect(await resolveSentenceNames(source, contact())).toEqual({});
		expect(source.listBuckets).not.toHaveBeenCalled();
	});

	it('does not look for a list in a bucket it could not find', async () => {
		const source = makeSource({ listBuckets: async () => [] });

		expect(await resolveSentenceNames(source, contact({ bucketId: B, listId: L }))).toEqual({});
		expect(source.listLists).not.toHaveBeenCalled();
	});

	it('names the survey and question of a survey response filter', async () => {
		const names = await resolveSentenceNames(makeSource(), {
			item: 'survey_question_response',
			operation: 'equals',
			value: { bucketId: B, surveyId: S, questionId: Q, response: 'Yes' }
		});

		expect(names).toEqual({ survey: 'Spring canvass', question: 'Vote for it?' });
	});

	it('leaves out a name that cannot be loaded', async () => {
		const source = makeSource({ listBuckets: async () => Promise.reject(new Error('boom')) });

		expect(await resolveSentenceNames(source, contact({ bucketId: B }))).toEqual({});
	});

	it('has nothing to name for other filters or an empty value', async () => {
		const source = makeSource();

		expect(await resolveSentenceNames(source, { item: 'city', operation: 'equals', value: 'Austin' })).toEqual({});
		expect(await resolveSentenceNames(source, { item: 'contact_made', operation: 'equals', value: '' })).toEqual({});
	});
});
