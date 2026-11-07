import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() };
	})
}));

const { setIntegrationEnabled } = vi.hoisted(() => ({ setIntegrationEnabled: vi.fn() }));
vi.mock('$lib/server/services/integrations.service', () => ({ setIntegrationEnabled }));

import { PATCH } from './+server';

function patch(id: string, body: unknown, locals: unknown = { user: { id: 'u1' } }) {
	return PATCH({
		params: { integration_id: id },
		locals,
		request: new Request('http://localhost/x', { method: 'PATCH', body: JSON.stringify(body) })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('PATCH /api/v1/integrations/[integration_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(patch('overture_maps', { enabled: true }, {})).rejects.toMatchObject({
			status: 401
		});
	});

	it('answers 400 for a malformed id or a body without a boolean', async () => {
		await expect(patch('../x', { enabled: true })).rejects.toMatchObject({ status: 400 });
		await expect(patch('overture_maps', { enabled: 'yes' })).rejects.toMatchObject({ status: 400 });
		expect(setIntegrationEnabled).not.toHaveBeenCalled();
	});

	it('hands the change to the service and echoes it', async () => {
		const res = await patch('overture_maps', { enabled: false });

		expect(await res.json()).toEqual({ enabled: false });
		expect(setIntegrationEnabled).toHaveBeenCalledWith('u1', 'overture_maps', false);
	});
});
