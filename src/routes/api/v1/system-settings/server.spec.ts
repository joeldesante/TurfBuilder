import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
	getSystemSettings: vi.fn(async () => [{ key: 'application_name', value: 'TurfBuilder', updatedAt: null }]),
	updateSystemSettings: vi.fn(async () => ({ saved: ['application_name'], restartRequired: false }))
}));
vi.mock('$lib/server/services/system-settings.service', () => svc);

import { GET, PATCH } from './+server';

type Handler = (e: never) => Response | Promise<Response>;
const signedIn = { user: { id: 'u1' } };

function patch(body: unknown, locals: unknown = signedIn) {
	return (PATCH as Handler)({ locals, request: new Request('http://x', { method: 'PATCH', body: JSON.stringify(body) }) } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /system-settings', () => {
	it('answers 401 when signed out', async () => {
		await expect((GET as Handler)({ locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('returns the settings for the caller', async () => {
		const res = await (GET as Handler)({ locals: signedIn } as never);

		expect(svc.getSystemSettings).toHaveBeenCalledWith('u1');
		expect(await res.json()).toHaveLength(1);
	});
});

describe('PATCH /system-settings', () => {
	it('answers 401 when signed out', async () => {
		await expect(patch({}, {})).rejects.toMatchObject({ status: 401 });
	});

	it('saves valid values', async () => {
		const res = await patch({ application_name: 'Acme' });

		expect(svc.updateSystemSettings).toHaveBeenCalledWith('u1', { application_name: 'Acme' });
		expect(await res.json()).toEqual({ saved: ['application_name'], restartRequired: false });
	});

	it('answers 400 with a message per bad key and saves nothing', async () => {
		const res = await patch({ application_name: '', unknown_key: 'x', 'links.tracing_url': 'ftp://x' });
		const body = await res.json();

		expect(res.status).toBe(400);
		expect(Object.keys(body.errors).sort()).toEqual(['application_name', 'links.tracing_url', 'unknown_key']);
		expect(typeof body.message).toBe('string');
		expect(svc.updateSystemSettings).not.toHaveBeenCalled();
	});

	it('answers 400 for a body that is not an object', async () => {
		expect((await patch('nope')).status).toBe(400);
		expect((await patch({})).status).toBe(400);
	});
});
