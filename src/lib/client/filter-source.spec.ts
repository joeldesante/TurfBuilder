import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFilterSource, loadOptions, resolveSentenceNames } from './filter-source';
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

describe('loadOptions', () => {
	const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

	function setup(fetcher: (() => Promise<string[]>) | null) {
		const set = vi.fn();
		const setFailed = vi.fn();
		const cleanup = loadOptions(fetcher, set, setFailed);
		return { set, setFailed, cleanup };
	}

	it('hands over the rows and says nothing failed', async () => {
		const { set, setFailed } = setup(async () => ['a', 'b']);
		await settle();

		expect(set).toHaveBeenCalledWith(['a', 'b']);
		expect(setFailed).toHaveBeenCalledWith(false);
	});

	it('gives no rows, and says it failed, when loading fails', async () => {
		const { set, setFailed } = setup(async () => Promise.reject(new Error('boom')));
		await settle();

		expect(set).toHaveBeenCalledWith([]);
		expect(setFailed).toHaveBeenCalledWith(true);
	});

	it('gives no rows straight away when there is nothing to ask for', () => {
		const { set, setFailed } = setup(null);

		expect(set).toHaveBeenCalledWith([]);
		expect(setFailed).not.toHaveBeenCalled();
	});

	it('ignores an answer that arrives after cleanup', async () => {
		const { set, setFailed, cleanup } = setup(async () => ['late']);
		cleanup();
		await settle();

		expect(set).not.toHaveBeenCalled();
		expect(setFailed).not.toHaveBeenCalled();
	});

	it('ignores a failure that arrives after cleanup', async () => {
		const { set, setFailed, cleanup } = setup(async () => Promise.reject(new Error('late')));
		cleanup();
		await settle();

		expect(set).not.toHaveBeenCalled();
		expect(setFailed).not.toHaveBeenCalled();
	});
});

describe('createFilterSource', () => {
	afterEach(() => vi.unstubAllGlobals());

	function stubFetch(response: Partial<Response> | Error) {
		const fetchMock = vi.fn(async (_url: string) => {
			if (response instanceof Error) throw response;
			return { ok: true, json: async () => [], ...response } as Response;
		});
		vi.stubGlobal('fetch', fetchMock);
		return fetchMock;
	}

	it('asks the API for each kind of choice', async () => {
		const fetchMock = stubFetch({});
		const source = createFilterSource('org1');

		await source.listBuckets();
		await source.listLists('b1');
		await source.listSurveys('b1');
		await source.listQuestions('s1');

		expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
			'/api/v1/organizations/org1/buckets',
			'/api/v1/buckets/b1/lists',
			'/api/v1/buckets/b1/surveys',
			'/api/v1/surveys/s1/questions'
		]);
	});

	it('returns what the API sends', async () => {
		stubFetch({ json: async () => [{ id: 'b1', name: 'Voters' }] });

		expect(await createFilterSource('org1').listBuckets()).toEqual([{ id: 'b1', name: 'Voters' }]);
	});

	it('says so in words fit to show when the server refuses', async () => {
		stubFetch({ ok: false, status: 500 });

		await expect(createFilterSource('org1').listBuckets()).rejects.toThrow('The choices could not be loaded.');
	});

	it('says so in words fit to show when the server cannot be reached', async () => {
		stubFetch(new Error('network down'));

		await expect(createFilterSource('org1').listBuckets()).rejects.toThrow(/Could not reach the server/);
	});
});
