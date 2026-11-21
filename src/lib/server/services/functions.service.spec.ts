import { describe, it, expect, vi, beforeEach } from 'vitest';

const { env } = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => ({ env }));

import {
	createDigitalOceanProvider,
	invokeFunction,
	FunctionInvokeError,
	FunctionsNotConfiguredError
} from './functions.service';

function provider(response: Response | Error) {
	const fetchMock = vi.fn(async () => {
		if (response instanceof Error) throw response;
		return response;
	});
	return {
		fetchMock,
		provider: createDigitalOceanProvider({
			apiUrl: 'https://faas.example/',
			namespace: 'fn-ns',
			apiKey: 'user:secret',
			fetch: fetchMock as unknown as typeof fetch
		})
	};
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('createDigitalOceanProvider', () => {
	it('starts a run without waiting, with the key and the args', async () => {
		const { provider: p, fetchMock } = provider(json({ activationId: 'abc' }, 202));

		const result = await p.invoke('import-contacts', { orgId: 'o', jobId: 'j' }, { wait: false });

		expect(result).toEqual({ activationId: 'abc' });
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe(
			'https://faas.example/api/v1/namespaces/fn-ns/actions/imports/import-contacts?blocking=false'
		);
		expect(init.method).toBe('POST');
		expect(init.body).toBe('{"orgId":"o","jobId":"j"}');
		expect((init.headers as Record<string, string>).authorization).toBe(
			`Basic ${Buffer.from('user:secret').toString('base64')}`
		);
	});

	it('returns what the function returned when it waits', async () => {
		const { provider: p } = provider(
			json({
				activationId: 'abc',
				response: { success: true, result: { body: { rowsProcessed: 3 } } }
			})
		);

		const result = await p.invoke('import-contacts', {}, { wait: true });

		expect(result).toEqual({ activationId: 'abc', result: { body: { rowsProcessed: 3 } } });
	});

	it('throws when a waited run failed', async () => {
		const { provider: p } = provider(
			json({ activationId: 'abc', response: { success: false, result: { error: 'x' } } })
		);

		await expect(p.invoke('import-contacts', {}, { wait: true })).rejects.toThrow(
			FunctionInvokeError
		);
	});

	it('throws with the status when the platform refuses', async () => {
		const { provider: p } = provider(json({ error: 'no' }, 401));

		await expect(p.invoke('import-contacts', {}, { wait: false })).rejects.toMatchObject({
			name: 'FunctionInvokeError',
			status: 401
		});
	});

	it('throws when the platform cannot be reached, without the underlying message', async () => {
		const { provider: p } = provider(new Error('connect ECONNREFUSED https://faas.example'));

		await expect(p.invoke('import-contacts', {}, { wait: false })).rejects.toThrow(
			'The function platform could not be reached'
		);
	});

	it('throws when the answer has no activation id', async () => {
		const { provider: p } = provider(json({}, 202));

		await expect(p.invoke('import-contacts', {}, { wait: false })).rejects.toThrow(
			FunctionInvokeError
		);
	});
});

beforeEach(() => {
	for (const key of Object.keys(env)) delete env[key];
	vi.unstubAllGlobals();
});

function configure() {
	env.FUNCTIONS_API_URL = 'http://localhost:3233';
	env.FUNCTIONS_API_KEY = 'k';
}

describe('invokeFunction', () => {
	it('refuses when the API url or key is missing', async () => {
		env.FUNCTIONS_API_URL = 'http://localhost:3233';

		await expect(invokeFunction('import-contacts', { orgId: 'o', jobId: 'j' })).rejects.toThrow(
			FunctionsNotConfiguredError
		);
	});

	it('refuses an unknown provider', async () => {
		configure();
		env.FUNCTIONS_PROVIDER = 'nowhere';

		await expect(invokeFunction('import-contacts', { orgId: 'o', jobId: 'j' })).rejects.toThrow(
			FunctionsNotConfiguredError
		);
	});

	it('starts without waiting by default, in the default namespace', async () => {
		configure();
		const fetchMock = vi.fn(async () => json({ activationId: 'abc' }, 202));
		vi.stubGlobal('fetch', fetchMock);

		const result = await invokeFunction('import-contacts', { orgId: 'o', jobId: 'j' });

		expect(result).toEqual({ activationId: 'abc' });
		expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
			'http://localhost:3233/api/v1/namespaces/_/actions/imports/import-contacts?blocking=false'
		);
	});

	it('waits when asked', async () => {
		configure();
		const fetchMock = vi.fn(async () =>
			json({ activationId: 'abc', response: { success: true, result: 1 } })
		);
		vi.stubGlobal('fetch', fetchMock);

		const result = await invokeFunction(
			'import-contacts',
			{ orgId: 'o', jobId: 'j' },
			{ wait: true }
		);

		expect(result).toEqual({ activationId: 'abc', result: 1 });
		expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toContain('blocking=true');
	});
});
