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

const { importPeopleCsv } = vi.hoisted(() => ({ importPeopleCsv: vi.fn() }));
vi.mock('$lib/server/services/people.service', () => ({ importPeopleCsv }));

import { POST } from './+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function upload(file?: File, locals: unknown = { user: { id: 'u1' } }) {
	const form = new FormData();
	if (file) form.set('file', file);
	return POST({
		params: { organization_id: ORG },
		locals,
		request: new Request('http://localhost/x', { method: 'POST', body: form })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/organizations/[organization_id]/people-imports', () => {
	it('answers 401 when signed out', async () => {
		await expect(upload(new File(['a'], 'p.csv'), {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 without a file or for a file that is not a .csv', async () => {
		await expect(upload()).rejects.toMatchObject({ status: 400 });
		await expect(upload(new File(['a'], 'p.xlsx'))).rejects.toMatchObject({ status: 400 });
		expect(importPeopleCsv).not.toHaveBeenCalled();
	});

	it("imports the file's text and answers 201 with the result", async () => {
		importPeopleCsv.mockResolvedValue({ imported: 1, skipped: 0, errors: [] });

		const res = await upload(new File(['first_name\nAda'], 'People.CSV'));

		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ imported: 1, skipped: 0, errors: [] });
		expect(importPeopleCsv).toHaveBeenCalledWith('u1', ORG, 'first_name\nAda');
	});
});
