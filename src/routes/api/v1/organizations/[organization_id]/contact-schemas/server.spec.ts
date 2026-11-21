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

const svc = vi.hoisted(() => ({ listContactSchemas: vi.fn(), createContactSchema: vi.fn() }));
vi.mock('$lib/server/services/contact-schemas.service', () => svc);

import { GET, POST } from './+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const F1 = '11111111-1111-4111-8111-111111111111';
const F2 = '22222222-2222-4222-8222-222222222222';
const params = { organization_id: ORG };
const signedIn = { user: { id: 'u1' } };

const title = { id: F1, name: 'Title', type: 'text', required: false };
const size = { id: F2, name: 'Size', type: 'number', required: true };

function post(body: unknown) {
	return POST({
		params,
		locals: signedIn,
		request: new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) })
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('/api/v1/organizations/[organization_id]/contact-schemas', () => {
	it('answers 401 when signed out and 400 for a malformed id', async () => {
		await expect(GET({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
		await expect(
			GET({ params: { organization_id: 'x' }, locals: signedIn } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it('lists the org schemas', async () => {
		svc.listContactSchemas.mockResolvedValue([{ id: 's1' }]);

		const res = await GET({ params, locals: signedIn } as never);

		expect(await res.json()).toEqual([{ id: 's1' }]);
		expect(svc.listContactSchemas).toHaveBeenCalledWith('u1', ORG);
	});

	it('creates with its fields and answers 201', async () => {
		svc.createContactSchema.mockResolvedValue({ id: 's1' });

		const res = await post({ schema_name: ' Business ', fields: [title, size] });

		expect(res.status).toBe(201);
		expect(svc.createContactSchema).toHaveBeenCalledWith('u1', ORG, {
			schema_name: 'Business',
			fields: [title, size]
		});
	});

	it('takes an identifier that is one of the text fields', async () => {
		svc.createContactSchema.mockResolvedValue({ id: 's1' });

		await post({ schema_name: 'Church', fields: [title, size], identifier_field_id: F1 });

		expect(svc.createContactSchema).toHaveBeenCalledWith(
			'u1',
			ORG,
			expect.objectContaining({ identifier_field_id: F1 })
		);
	});

	it('answers 400 for a blank name, an unknown type, a missing id, or a field without a name', async () => {
		await expect(post({ schema_name: ' ', fields: [] })).rejects.toMatchObject({ status: 400 });
		await expect(
			post({ schema_name: 'a', fields: [{ ...title, type: 'date' }] })
		).rejects.toMatchObject({ status: 400 });
		await expect(
			post({ schema_name: 'a', fields: [{ name: 'x', type: 'text', required: false }] })
		).rejects.toMatchObject({ status: 400 });
		await expect(
			post({ schema_name: 'a', fields: [{ ...title, name: '' }] })
		).rejects.toMatchObject({
			status: 400
		});
		expect(svc.createContactSchema).not.toHaveBeenCalled();
	});

	it('answers 400 for field names that differ only by case, or an id used twice', async () => {
		await expect(
			post({ schema_name: 'a', fields: [title, { ...size, name: 'title' }] })
		).rejects.toMatchObject({ status: 400 });
		await expect(
			post({ schema_name: 'a', fields: [title, { ...size, id: F1 }] })
		).rejects.toMatchObject({ status: 400 });
		expect(svc.createContactSchema).not.toHaveBeenCalled();
	});

	it('answers 400 for an identifier that is missing from the fields or is not a text field', async () => {
		const base = { schema_name: 'Church', fields: [title, size] };

		await expect(post({ ...base, identifier_field_id: F2 })).rejects.toMatchObject({ status: 400 });
		await expect(
			post({ ...base, identifier_field_id: '33333333-3333-4333-8333-333333333333' })
		).rejects.toMatchObject({ status: 400 });
		await expect(post({ ...base, identifier_field_id: 'x' })).rejects.toMatchObject({
			status: 400
		});
		expect(svc.createContactSchema).not.toHaveBeenCalled();
	});
});
