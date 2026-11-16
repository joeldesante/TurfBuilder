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

const svc = vi.hoisted(() => ({
	getContactSchema: vi.fn(),
	updateContactSchema: vi.fn(),
	deleteContactSchema: vi.fn()
}));
vi.mock('$lib/server/services/contact-schemas.service', () => svc);

import { GET, PATCH, DELETE } from './+server';

const ID = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const F1 = '11111111-1111-4111-8111-111111111111';
const F2 = '22222222-2222-4222-8222-222222222222';
const params = { contact_schema_id: ID };
const signedIn = { user: { id: 'u1' } };

const title = { id: F1, name: 'Title', type: 'text', required: false };
const size = { id: F2, name: 'Size', type: 'number', required: true };

function patch(body: unknown) {
	return PATCH({
		params,
		locals: signedIn,
		request: new Request('http://localhost/x', { method: 'PATCH', body: JSON.stringify(body) })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('/api/v1/contact-schemas/[contact_schema_id]', () => {
	it('answers 401 when signed out and 400 for a malformed id', async () => {
		await expect(GET({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
		await expect(
			GET({ params: { contact_schema_id: 'x' }, locals: signedIn } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns the schema', async () => {
		svc.getContactSchema.mockResolvedValue({ id: ID });

		const res = await GET({ params, locals: signedIn } as never);

		expect(await res.json()).toEqual({ id: ID });
		expect(svc.getContactSchema).toHaveBeenCalledWith('u1', ID);
	});

	it('updates with a trimmed name and the full list of fields', async () => {
		svc.updateContactSchema.mockResolvedValue({ id: ID });

		await patch({ schema_name: ' Business ', fields: [title, size] });

		expect(svc.updateContactSchema).toHaveBeenCalledWith('u1', ID, {
			schema_name: 'Business',
			fields: [title, size]
		});
	});

	it('answers 400 for an empty body, an unknown type, or names that differ only by case', async () => {
		await expect(patch({})).rejects.toMatchObject({ status: 400 });
		await expect(patch({ fields: [{ ...title, type: 'date' }] })).rejects.toMatchObject({
			status: 400
		});
		await expect(patch({ fields: [title, { ...size, name: 'TITLE' }] })).rejects.toMatchObject({
			status: 400
		});
		expect(svc.updateContactSchema).not.toHaveBeenCalled();
	});

	it('accepts an identifier change alone, and null to go back to the address', async () => {
		svc.updateContactSchema.mockResolvedValue({ id: ID });

		await patch({ identifier_field_id: F1 });
		await patch({ identifier_field_id: null });

		expect(svc.updateContactSchema).toHaveBeenNthCalledWith(1, 'u1', ID, {
			identifier_field_id: F1
		});
		expect(svc.updateContactSchema).toHaveBeenNthCalledWith(2, 'u1', ID, {
			identifier_field_id: null
		});
	});

	it('answers 400 when sent fields do not fit the identifier sent with them', async () => {
		await expect(patch({ fields: [title, size], identifier_field_id: F2 })).rejects.toMatchObject({
			status: 400
		});
		await expect(patch({ fields: [title], identifier_field_id: F2 })).rejects.toMatchObject({
			status: 400
		});
		expect(svc.updateContactSchema).not.toHaveBeenCalled();
	});

	it('deletes and answers 204', async () => {
		const res = await DELETE({ params, locals: signedIn } as never);

		expect(res.status).toBe(204);
		expect(svc.deleteContactSchema).toHaveBeenCalledWith('u1', ID);
	});
});
