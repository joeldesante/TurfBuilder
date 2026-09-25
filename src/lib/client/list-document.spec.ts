import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadListDocument, regenerateListDocument } from './list-document';

const BASE = '/api/v1/organizations/org-1/lists/list-1/documents';
const now = () => new Date().toISOString();

const assign = vi.fn();
const fetchMock = vi.fn();

/** Routes fetch calls by method and URL to canned JSON responses. */
function respond(routes: Record<string, unknown | (() => unknown)>) {
	fetchMock.mockImplementation((url: string, init?: RequestInit) => {
		const key = `${init?.method ?? 'GET'} ${url}`;
		if (!(key in routes)) throw new Error(`Unexpected ${key}`);
		const value = routes[key];
		const body = typeof value === 'function' ? value() : value;
		return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
	});
}

function calls(): string[] {
	return fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${url}`);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('fetch', fetchMock);
	vi.stubGlobal('window', { location: { assign } });
	fetchMock.mockReset();
	assign.mockReset();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('downloadListDocument', () => {
	it('downloads a ready pdf straight away without generating', async () => {
		respond({
			[`GET ${BASE}`]: [{ id: 'd1', status: 'ready', error: null, created_at: now() }],
			[`GET ${BASE}/d1`]: { id: 'd1', status: 'ready', download_url: 'https://spaces/d1' }
		});
		const onGenerating = vi.fn();

		await downloadListDocument('org-1', 'list-1', onGenerating);

		expect(onGenerating).not.toHaveBeenCalled();
		expect(calls()).not.toContain(`POST ${BASE}`);
		expect(assign).toHaveBeenCalledWith('https://spaces/d1');
	});

	it('generates one when none exists, then downloads it once ready', async () => {
		let polls = 0;
		respond({
			[`GET ${BASE}`]: [],
			[`POST ${BASE}`]: { id: 'd2', status: 'pending', created_at: now() },
			[`GET ${BASE}/d2`]: () =>
				++polls < 3
					? { id: 'd2', status: 'pending' }
					: { id: 'd2', status: 'ready', download_url: 'https://spaces/d2' }
		});
		const onGenerating = vi.fn();

		const done = downloadListDocument('org-1', 'list-1', onGenerating);
		await vi.runAllTimersAsync();
		await done;

		expect(onGenerating).toHaveBeenCalledOnce();
		expect(assign).toHaveBeenCalledWith('https://spaces/d2');
	});

	it('joins a recent pending document instead of starting another', async () => {
		respond({
			[`GET ${BASE}`]: [{ id: 'd3', status: 'pending', error: null, created_at: now() }],
			[`GET ${BASE}/d3`]: { id: 'd3', status: 'ready', download_url: 'https://spaces/d3' }
		});

		await downloadListDocument('org-1', 'list-1', vi.fn());

		expect(calls()).not.toContain(`POST ${BASE}`);
		expect(assign).toHaveBeenCalledWith('https://spaces/d3');
	});

	// A server restart mid-render leaves the row pending forever.
	it('starts a new document when the pending one is stale', async () => {
		const stale = new Date(Date.now() - 10 * 60_000).toISOString();
		respond({
			[`GET ${BASE}`]: [{ id: 'old', status: 'pending', error: null, created_at: stale }],
			[`POST ${BASE}`]: { id: 'd4', status: 'pending', created_at: now() },
			[`GET ${BASE}/d4`]: { id: 'd4', status: 'ready', download_url: 'https://spaces/d4' }
		});

		await downloadListDocument('org-1', 'list-1', vi.fn());

		expect(calls()).toContain(`POST ${BASE}`);
		expect(assign).toHaveBeenCalledWith('https://spaces/d4');
	});

	it('retries past a failed document', async () => {
		respond({
			[`GET ${BASE}`]: [{ id: 'bad', status: 'failed', error: 'boom', created_at: now() }],
			[`POST ${BASE}`]: { id: 'd5', status: 'pending', created_at: now() },
			[`GET ${BASE}/d5`]: { id: 'd5', status: 'ready', download_url: 'https://spaces/d5' }
		});

		await downloadListDocument('org-1', 'list-1', vi.fn());

		expect(assign).toHaveBeenCalledWith('https://spaces/d5');
	});

	it('rejects with the server reason when generation fails', async () => {
		respond({
			[`GET ${BASE}`]: [],
			[`POST ${BASE}`]: { id: 'd6', status: 'pending', created_at: now() },
			[`GET ${BASE}/d6`]: { id: 'd6', status: 'failed', error: 'Object storage is not configured.' }
		});

		await expect(downloadListDocument('org-1', 'list-1', vi.fn())).rejects.toThrow(
			'Object storage is not configured.'
		);
		expect(assign).not.toHaveBeenCalled();
	});

	it('gives up after waiting too long', async () => {
		respond({
			[`GET ${BASE}`]: [],
			[`POST ${BASE}`]: { id: 'd7', status: 'pending', created_at: now() },
			[`GET ${BASE}/d7`]: { id: 'd7', status: 'pending' }
		});

		const done = downloadListDocument('org-1', 'list-1', vi.fn());
		const assertion = expect(done).rejects.toThrow('taking too long');
		await vi.runAllTimersAsync();
		await assertion;
	});

	it('says the server could not be reached when the request fails outright', async () => {
		fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

		await expect(downloadListDocument('org-1', 'list-1', vi.fn())).rejects.toThrow(
			'Could not reach the server. Check your connection and try again.'
		);
	});

	// A 5xx body could hold anything; never show it.
	it('replaces server error details with a generic message', async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ message: 'relation "universe.list" does not exist' }), {
				status: 500
			})
		);

		await expect(downloadListDocument('org-1', 'list-1', vi.fn())).rejects.toThrow(
			'Something went wrong on the server. Try again shortly.'
		);
	});

	it('surfaces the API error message', async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
		);

		await expect(downloadListDocument('org-1', 'list-1', vi.fn())).rejects.toThrow('Forbidden');
	});
});

describe('regenerateListDocument', () => {
	it('generates a new pdf even when one is ready, then downloads the new one', async () => {
		let polls = 0;
		respond({
			[`POST ${BASE}`]: { id: 'new', status: 'pending', created_at: now() },
			[`GET ${BASE}/new`]: () =>
				++polls < 2
					? { id: 'new', status: 'pending' }
					: { id: 'new', status: 'ready', download_url: 'https://spaces/new' }
		});
		const onGenerating = vi.fn();

		const done = regenerateListDocument('org-1', 'list-1', onGenerating);
		await vi.runAllTimersAsync();
		await done;

		// Never looks for the existing pdf: the server replaces it on POST.
		expect(calls()).not.toContain(`GET ${BASE}`);
		expect(onGenerating).toHaveBeenCalledOnce();
		expect(assign).toHaveBeenCalledWith('https://spaces/new');
	});

	it("sends the browser's timezone so times print as the requester reads them", async () => {
		respond({
			[`POST ${BASE}`]: { id: 'new', status: 'pending', created_at: now() },
			[`GET ${BASE}/new`]: { id: 'new', status: 'ready', download_url: 'https://spaces/new' }
		});

		await regenerateListDocument('org-1', 'list-1', vi.fn());

		const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
		expect(JSON.parse(post[1].body)).toEqual({
			timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
		});
		expect(post[1].headers).toEqual({ 'content-type': 'application/json' });
	});

	it('rejects with the server reason when regeneration fails', async () => {
		respond({
			[`POST ${BASE}`]: { id: 'new', status: 'pending', created_at: now() },
			[`GET ${BASE}/new`]: { id: 'new', status: 'failed', error: 'render failed' }
		});

		await expect(regenerateListDocument('org-1', 'list-1', vi.fn())).rejects.toThrow(
			'render failed'
		);
		expect(assign).not.toHaveBeenCalled();
	});
});
