import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, ApiError, errorMessage } from './api';

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

describe('api', () => {
	it('sends a body as JSON under /api/v1 and returns the JSON answer', async () => {
		fetchMock.mockResolvedValue(new Response('{"id":"x"}'));

		expect(await api('/things', { method: 'POST', body: { name: 'A' } })).toEqual({ id: 'x' });

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/v1/things');
		expect(init.headers).toEqual({ 'content-type': 'application/json' });
		expect(init.body).toBe('{"name":"A"}');
	});

	it('sends FormData as is, so the browser sets the multipart boundary', async () => {
		fetchMock.mockResolvedValue(new Response('{}'));
		const form = new FormData();
		form.set('file', new Blob(['a,b']), 'people.csv');

		await api('/imports', { method: 'POST', body: form });

		const [, init] = fetchMock.mock.calls[0];
		expect(init.body).toBe(form);
		expect(init.headers).toBeUndefined();
	});

	it('returns undefined for 204', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

		expect(await api('/things/1', { method: 'DELETE' })).toBeUndefined();
	});

	it("throws the server's message for a 4xx, and generic wording for a 5xx", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response('{"message":"Name is required."}', { status: 400 })
		);
		await expect(api('/x')).rejects.toMatchObject({ status: 400, message: 'Name is required.' });

		fetchMock.mockResolvedValueOnce(new Response('{"message":"stack trace"}', { status: 500 }));
		await expect(api('/x')).rejects.toMatchObject({
			status: 500,
			message: 'Something went wrong on the server. Try again shortly.'
		});
	});

	it('reports a network failure without its details', async () => {
		fetchMock.mockRejectedValue(new TypeError('fetch failed'));

		const e = await api('/x').catch((err) => err);

		expect(e).toBeInstanceOf(ApiError);
		expect(errorMessage(e)).toBe(
			'Could not reach the server. Check your connection and try again.'
		);
	});
});
