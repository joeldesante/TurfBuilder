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

const { getScript, updateScript } = vi.hoisted(() => ({
	getScript: vi.fn(),
	updateScript: vi.fn()
}));

vi.mock('$lib/server/services/scripts.service', () => ({ getScript, updateScript }));

import { GET, PATCH } from './+server';

const SCRIPT = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const params = { script_id: SCRIPT };
const signedIn = { user: { id: 'u1' } };

function patch(body: unknown, locals: unknown = signedIn) {
	return PATCH({
		params,
		locals,
		request: new Request('http://localhost/api/v1/scripts/x', {
			method: 'PATCH',
			body: JSON.stringify(body)
		})
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/scripts/[script_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(GET({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed script id', async () => {
		await expect(
			GET({ params: { script_id: 'nope' }, locals: signedIn } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns the script', async () => {
		getScript.mockResolvedValue({ id: SCRIPT, contents: 'Hi' });

		const res = await GET({ params, locals: signedIn } as never);

		expect(await res.json()).toEqual({ id: SCRIPT, contents: 'Hi' });
		expect(getScript).toHaveBeenCalledWith('u1', SCRIPT);
	});
});

describe('PATCH /api/v1/scripts/[script_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(patch({ contents: 'x' }, {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a blank name', async () => {
		await expect(patch({ name: '' })).rejects.toMatchObject({ status: 400 });
		expect(updateScript).not.toHaveBeenCalled();
	});

	it('answers 400 when the contents are not text', async () => {
		await expect(patch({ contents: 42 })).rejects.toMatchObject({ status: 400 });
	});

	it('passes only the fields sent', async () => {
		updateScript.mockResolvedValue({ id: SCRIPT });

		await patch({ contents: 'New text' });

		expect(updateScript).toHaveBeenCalledWith('u1', SCRIPT, { contents: 'New text' });
	});
});
