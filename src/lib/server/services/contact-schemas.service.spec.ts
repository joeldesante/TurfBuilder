import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const { mockClient, canOrg } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() },
	canOrg: vi.fn()
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return {
			query: mockClient.query,
			connect: vi.fn().mockResolvedValue(mockClient),
			on: vi.fn(),
			end: vi.fn()
		};
	})
}));

vi.mock('$lib/server/permissions', () => ({ canOrg }));

import {
	listContactSchemas,
	createContactSchema,
	getContactSchema,
	updateContactSchema,
	deleteContactSchema,
	listSchemaContacts,
	reorderContactSchemas,
	listAllContacts,
	listContactMarkers
} from './contact-schemas.service';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SCHEMA = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const row = {
	id: SCHEMA,
	org_id: ORG,
	schema_name: 'Business',
	fields: [],
	identifier_field_id: null,
	contact_count: 0
};

/** Answers membership and the schema-in-org lookup, and everything else with `rest`. */
function stub(
	rest: (sql: string, values?: unknown[]) => unknown = () => ({ rowCount: 1, rows: [row] })
) {
	mockClient.query.mockImplementation((sql: string, values?: unknown[]) => {
		if (sql.includes('FROM auth.member')) {
			return Promise.resolve({ rowCount: 1, rows: [{ organization_id: ORG, role: 'member' }] });
		}
		if (sql.includes('SELECT 1 FROM universe.contact_schema WHERE id = $1 AND org_id = $2')) {
			if (sql.includes('FOR UPDATE')) return Promise.resolve(rest(sql, values));
			return Promise.resolve({ rowCount: 1, rows: [{}] });
		}
		return Promise.resolve(rest(sql, values));
	});
}

function sqlRun(fragment: string) {
	return mockClient.query.mock.calls.find((c) => String(c[0]).includes(fragment));
}

beforeEach(() => {
	vi.clearAllMocks();
	canOrg.mockResolvedValue(true);
	stub();
});

describe('listContactSchemas', () => {
	it("selects only the org's schemas", async () => {
		const result = await listContactSchemas('u1', ORG);

		expect(result).toEqual([row]);
		expect(sqlRun('WHERE cs.org_id = $1')![1]).toEqual([ORG]);
	});

	it('answers 403 without staff access', async () => {
		canOrg.mockResolvedValue(false);

		await expect(listContactSchemas('u1', ORG)).rejects.toMatchObject({ status: 403 });
	});
});

const F1 = '11111111-1111-4111-8111-111111111111';
const F2 = '22222222-2222-4222-8222-222222222222';
const F3 = '33333333-3333-4333-8333-333333333333';
const name = { id: F1, name: 'Name', type: 'text' as const, required: false };
const size = { id: F2, name: 'Size', type: 'number' as const, required: true };
const input = { schema_name: 'Business', fields: [name, size] };

function calls(fragment: string) {
	return mockClient.query.mock.calls.filter((c) => String(c[0]).includes(fragment));
}

describe('createContactSchema', () => {
	function stubCreate() {
		stub((sql) => {
			if (sql.includes('INSERT INTO universe.contact_schema ')) {
				return { rowCount: 1, rows: [{ id: SCHEMA }] };
			}
			return { rowCount: 1, rows: [row] };
		});
	}

	it('writes the schema, then its fields in order, as the org', async () => {
		stubCreate();

		await createContactSchema('u1', ORG, input);

		expect(sqlRun('INSERT INTO universe.contact_schema ')![1]).toEqual([ORG, 'Business']);
		const fields = calls('INSERT INTO universe.contact_schema_field');
		expect(fields.map((c) => c[1])).toEqual([
			[F1, ORG, SCHEMA, 'Name', 'text', false, 0],
			[F2, ORG, SCHEMA, 'Size', 'number', true, 1]
		]);
		expect(calls('SET identifier_field_id')).toHaveLength(0);
	});

	it('points the identifier at its field after the fields exist, and makes that field required', async () => {
		stubCreate();

		await createContactSchema('u1', ORG, { ...input, identifier_field_id: F1 });

		const order = mockClient.query.mock.calls.map((c) => String(c[0]));
		expect(
			order.findIndex((s) => s.includes('INSERT INTO universe.contact_schema_field'))
		).toBeLessThan(order.findIndex((s) => s.includes('SET identifier_field_id')));
		expect(calls('INSERT INTO universe.contact_schema_field')[0][1][5]).toBe(true);
		expect(calls('SET identifier_field_id')[0][1]).toEqual([SCHEMA, ORG, F1]);
	});

	it('answers 409 for a taken schema name and for a repeated field name', async () => {
		stub((sql) => {
			if (sql.includes('INSERT INTO universe.contact_schema ')) {
				throw Object.assign(new Error('dup'), {
					code: '23505',
					constraint: 'contact_schema_org_name_unique'
				});
			}
			return { rowCount: 1, rows: [row] };
		});
		await expect(createContactSchema('u1', ORG, input)).rejects.toMatchObject({
			status: 409,
			body: { message: expect.stringContaining('schema with that name') }
		});

		stub((sql) => {
			if (sql.includes('INSERT INTO universe.contact_schema_field')) {
				throw Object.assign(new Error('dup'), {
					code: '23505',
					constraint: 'contact_schema_field_name_unique'
				});
			}
			return { rowCount: 1, rows: [{ id: SCHEMA }] };
		});
		await expect(createContactSchema('u1', ORG, input)).rejects.toMatchObject({
			status: 409,
			body: { message: expect.stringContaining('Field names must be different') }
		});
	});

	it('answers 400 when the database refuses the identifier', async () => {
		stub((sql) => {
			if (sql.includes('SET identifier_field_id')) {
				throw Object.assign(new Error('check'), { code: '23514' });
			}
			return { rowCount: 1, rows: [{ id: SCHEMA }] };
		});

		await expect(
			createContactSchema('u1', ORG, { ...input, identifier_field_id: F2 })
		).rejects.toMatchObject({ status: 400 });
	});
});

describe('getContactSchema', () => {
	it('returns the schema', async () => {
		expect(await getContactSchema('u1', SCHEMA)).toEqual(row);
	});

	it('answers 404 when no org of the caller has it', async () => {
		mockClient.query.mockImplementation((sql: string) =>
			Promise.resolve(
				sql.includes('FROM auth.member')
					? { rowCount: 1, rows: [{ organization_id: ORG }] }
					: { rowCount: 0, rows: [] }
			)
		);

		await expect(getContactSchema('u1', SCHEMA)).rejects.toMatchObject({ status: 404 });
	});
});

describe('updateContactSchema', () => {
	/** The stored identifier, the fields it has now, and how many contacts use it. */
	function stubUpdate({
		identifier = null as string | null,
		existing = [
			{ id: F1, type: 'text' },
			{ id: F2, type: 'number' }
		] as { id: string; type: string }[],
		used = 0
	} = {}) {
		stub((sql) => {
			if (sql.includes('SELECT identifier_field_id FROM universe.contact_schema')) {
				return { rowCount: 1, rows: [{ identifier_field_id: identifier }] };
			}
			if (sql.includes('SELECT id, type FROM universe.contact_schema_field')) {
				return { rows: existing };
			}
			if (sql.includes('FROM universe.org_contact WHERE schema_id')) {
				return { rows: [{ count: used }] };
			}
			return { rowCount: 1, rows: [row] };
		});
	}

	it('renames a schema without touching its fields', async () => {
		stubUpdate();

		await updateContactSchema('u1', SCHEMA, { schema_name: 'Shops' });

		expect(sqlRun('SET schema_name = $3')![1]).toEqual([SCHEMA, ORG, 'Shops']);
		expect(calls('INSERT INTO universe.contact_schema_field')).toHaveLength(0);
		expect(calls('UPDATE universe.contact_schema_field')).toHaveLength(0);
		expect(calls('DELETE FROM universe.contact_schema_field')).toHaveLength(0);
	});

	it('renames a field by its id, keeps it in place, and adds and removes the others', async () => {
		stubUpdate();

		await updateContactSchema('u1', SCHEMA, {
			fields: [
				{ ...name, name: 'Title' },
				{ id: F3, name: 'Open', type: 'boolean', required: false }
			]
		});

		// F1 is updated under the same id, F3 is new, and F2 is gone.
		expect(calls('SET name = $4, type = $5')[0][1]).toEqual([
			F1,
			SCHEMA,
			ORG,
			'Title',
			'text',
			false,
			0
		]);
		expect(calls('INSERT INTO universe.contact_schema_field')[0][1]).toEqual([
			F3,
			ORG,
			SCHEMA,
			'Open',
			'boolean',
			false,
			1
		]);
		expect(calls('DELETE FROM universe.contact_schema_field')[0][1]).toEqual([SCHEMA, ORG, [F2]]);
	});

	it('sets existing names aside first so two fields can swap names', async () => {
		stubUpdate();

		await updateContactSchema('u1', SCHEMA, {
			fields: [
				{ ...name, name: 'Size', type: 'text' },
				{ ...size, name: 'Name', type: 'number' }
			]
		});

		const order = mockClient.query.mock.calls.map((c) => String(c[0]));
		const aside = order.findIndex((s) => s.includes('SET name = id::text'));
		const final = order.findIndex((s) => s.includes('SET name = $4, type = $5'));
		expect(aside).toBeGreaterThan(-1);
		expect(aside).toBeLessThan(final);
	});

	it('clears the identifier when its field is removed', async () => {
		stubUpdate({ identifier: F1 });

		await updateContactSchema('u1', SCHEMA, { fields: [size] });

		const clear = calls('SET identifier_field_id = NULL')[0];
		expect(clear[1]).toEqual([SCHEMA, ORG, [F2]]);
	});

	it('answers 409 when a field changes type but contacts already use the schema', async () => {
		stubUpdate({ used: 2 });

		await expect(
			updateContactSchema('u1', SCHEMA, { fields: [{ ...name, type: 'number' }, size] })
		).rejects.toMatchObject({ status: 409, body: { message: expect.stringContaining('"Name"') } });
		expect(calls('SET name = $4, type = $5')).toHaveLength(0);
	});

	it('lets a renamed or newly required field change when contacts use the schema', async () => {
		stubUpdate({ used: 2 });

		await updateContactSchema('u1', SCHEMA, {
			fields: [{ ...name, name: 'Title', required: true }, size]
		});

		expect(calls('SET name = $4, type = $5')).toHaveLength(2);
	});

	it('sets only the identifier, and makes its field required', async () => {
		stubUpdate();

		await updateContactSchema('u1', SCHEMA, { identifier_field_id: F1 });

		expect(sqlRun('SET identifier_field_id = $3')![1]).toEqual([SCHEMA, ORG, F1]);
		expect(sqlRun('SET required = true')![1]).toEqual([F1, SCHEMA, ORG]);
	});

	it('goes back to the default identifier with null', async () => {
		stubUpdate({ identifier: F1 });

		await updateContactSchema('u1', SCHEMA, { identifier_field_id: null });

		expect(sqlRun('SET identifier_field_id = $3')![1]).toEqual([SCHEMA, ORG, null]);
		expect(sqlRun('SET required = true')).toBeUndefined();
	});

	it('answers 409 for a taken name and 400 when the database refuses the change', async () => {
		stub((sql) => {
			if (sql.includes('SELECT identifier_field_id')) {
				return { rowCount: 1, rows: [{ identifier_field_id: null }] };
			}
			if (sql.includes('SET schema_name')) {
				throw Object.assign(new Error('dup'), {
					code: '23505',
					constraint: 'contact_schema_org_name_unique'
				});
			}
			return { rowCount: 1, rows: [row] };
		});
		await expect(updateContactSchema('u1', SCHEMA, { schema_name: 'Taken' })).rejects.toMatchObject(
			{
				status: 409
			}
		);

		stub((sql) => {
			if (sql.includes('SELECT identifier_field_id')) {
				return { rowCount: 1, rows: [{ identifier_field_id: null }] };
			}
			if (sql.includes('SET identifier_field_id')) {
				throw Object.assign(new Error('check'), { code: '23514' });
			}
			return { rowCount: 1, rows: [row] };
		});
		await expect(
			updateContactSchema('u1', SCHEMA, { identifier_field_id: F2 })
		).rejects.toMatchObject({
			status: 400
		});
	});

	it('answers 404 when the schema is not there', async () => {
		stub((sql) =>
			sql.includes('SELECT identifier_field_id')
				? { rowCount: 0, rows: [] }
				: { rowCount: 1, rows: [row] }
		);

		await expect(updateContactSchema('u1', SCHEMA, { schema_name: 'X' })).rejects.toMatchObject({
			status: 404
		});
	});
});

describe('deleteContactSchema', () => {
	it('deletes a schema no contact uses', async () => {
		stub((sql) =>
			sql.includes('count(*)') ? { rows: [{ count: 0 }] } : { rowCount: 1, rows: [{}] }
		);

		await deleteContactSchema('u1', SCHEMA);

		expect(sqlRun('DELETE FROM universe.contact_schema')![1]).toEqual([SCHEMA, ORG]);
	});

	it('answers 409 and deletes nothing while contacts use it', async () => {
		stub((sql) =>
			sql.includes('count(*)') ? { rows: [{ count: 3 }] } : { rowCount: 1, rows: [{}] }
		);

		await expect(deleteContactSchema('u1', SCHEMA)).rejects.toMatchObject({
			status: 409,
			body: { message: expect.stringContaining('3 contacts') }
		});
		expect(sqlRun('DELETE FROM universe.contact_schema')).toBeUndefined();
	});

	it('answers 409 when the database refuses because a contact started using it', async () => {
		stub((sql) => {
			if (sql.includes('count(*)')) return { rows: [{ count: 0 }] };
			if (sql.includes('DELETE')) throw Object.assign(new Error('fk'), { code: '23503' });
			return { rowCount: 1, rows: [{}] };
		});

		await expect(deleteContactSchema('u1', SCHEMA)).rejects.toMatchObject({ status: 409 });
	});
});

describe('listSchemaContacts', () => {
	it('counts and reads only current contacts of the schema in the org', async () => {
		stub((sql) =>
			sql.includes('count(*)')
				? { rows: [{ count: 250 }] }
				: { rows: [{ id: 'e1', metadata: { name: 'Deli' } }] }
		);

		const result = await listSchemaContacts('u1', SCHEMA, 2);

		expect(result).toEqual({
			items: [{ id: 'e1', metadata: { name: 'Deli' } }],
			totalCount: 250,
			page: 2,
			pageSize: 100
		});
		expect(sqlRun('valid_from DESC')![1]).toEqual([ORG, SCHEMA, 100, 100]);
		expect(sqlRun('count(*)::int AS count')![0]).toContain('valid_to IS NULL');
	});

	it('answers 403 without staff access', async () => {
		canOrg.mockResolvedValue(false);

		await expect(listSchemaContacts('u1', SCHEMA, 1)).rejects.toMatchObject({ status: 403 });
	});
});

describe('reorderContactSchemas', () => {
	const A = 'aaaaaaaa-e5f6-7890-abcd-ef1234567890';
	const B = 'bbbbbbbb-e5f6-7890-abcd-ef1234567890';

	function stubSchemas(ids: string[]) {
		stub((sql) =>
			sql.includes('FOR UPDATE') ? { rows: ids.map((id) => ({ id })) } : { rowCount: 2, rows: [] }
		);
	}

	it('numbers the schemas in the given order', async () => {
		stubSchemas([A, B]);

		await reorderContactSchemas('u1', ORG, [B, A]);

		expect(sqlRun('SET position')![1]).toEqual([ORG, [B, A]]);
	});

	it('answers 409 and changes nothing when a schema is missing, extra, or repeated', async () => {
		stubSchemas([A, B]);

		await expect(reorderContactSchemas('u1', ORG, [A])).rejects.toMatchObject({ status: 409 });
		await expect(reorderContactSchemas('u1', ORG, [A, A])).rejects.toMatchObject({ status: 409 });
		await expect(
			reorderContactSchemas('u1', ORG, [A, 'cccccccc-e5f6-7890-abcd-ef1234567890'])
		).rejects.toMatchObject({ status: 409 });
		expect(sqlRun('SET position')).toBeUndefined();
	});

	it('answers 403 without staff access', async () => {
		canOrg.mockResolvedValue(false);

		await expect(reorderContactSchemas('u1', ORG, [])).rejects.toMatchObject({ status: 403 });
	});
});

describe('listAllContacts', () => {
	it('reads every current contact of the org with its schema name', async () => {
		stub((sql) =>
			sql.includes('count(*)')
				? { rows: [{ count: 1 }] }
				: { rows: [{ id: 'e1', metadata: {}, schema_id: null, schema_name: null }] }
		);

		const result = await listAllContacts('u1', ORG, 1);

		expect(result.totalCount).toBe(1);
		expect(sqlRun('LEFT JOIN universe.contact_schema')![1]).toEqual([ORG, 100, 0]);
	});
});

describe('listContactMarkers', () => {
	it('reads current contacts of the org that have a position, for every schema when none is given', async () => {
		stub(() => ({ rows: [{ id: 'e1', name: 'Deli', latitude: 40, longitude: -75 }] }));

		const result = await listContactMarkers('u1', ORG, null);

		expect(result).toHaveLength(1);
		const call = sqlRun('a.coordinates IS NOT NULL')!;
		expect(call[0]).toContain('c.valid_to IS NULL');
		expect(call[1]).toEqual([ORG, 5000]);
	});

	it('limits the pins to one schema', async () => {
		stub(() => ({ rows: [] }));

		await listContactMarkers('u1', ORG, SCHEMA);

		expect(sqlRun('a.coordinates IS NOT NULL')![1]).toEqual([ORG, SCHEMA, 5000]);
	});

	it('answers 403 without staff access', async () => {
		canOrg.mockResolvedValue(false);

		await expect(listContactMarkers('u1', ORG, null)).rejects.toMatchObject({ status: 403 });
	});
});

describe('searching and filtering contacts', () => {
	const austin = {
		operator: 'AND' as const,
		filters: [{ item: 'city', operation: 'equals' as const, value: 'Austin' }]
	};

	function countCall() {
		return mockClient.query.mock.calls.find((c) =>
			String(c[0]).includes('count(*)::int AS count')
		)!;
	}

	function stubCounts() {
		stub((sql) => (sql.includes('count(*)') ? { rows: [{ count: 0 }] } : { rows: [] }));
	}

	it('looks for the search text in the identifier and the values, matching wildcards literally', async () => {
		stubCounts();

		await listAllContacts('u1', ORG, 1, { search: '  50%_off  ' });

		const [sql, params] = countCall();
		expect(sql).toContain('ILIKE $2');
		// Values only: the keys are field ids.
		expect(sql).toContain('jsonb_each_text(c.metadata)');
		expect(sql).not.toContain('metadata::text');
		// The page's limit and offset are added after the count has run.
		expect((params as unknown[]).slice(0, 2)).toEqual([ORG, '%50\\%\\_off%']);
	});

	it('adds no search condition for blank text', async () => {
		stubCounts();

		await listAllContacts('u1', ORG, 1, { search: '   ' });

		expect(countCall()[0]).not.toContain('ILIKE');
	});

	it('keeps only the contacts the filters select, numbering its own parameters after theirs', async () => {
		stubCounts();

		await listAllContacts('u1', ORG, 1, { filters: austin, search: 'deli' });

		const [sql, params] = mockClient.query.mock.calls.find((c) => String(c[0]).includes('LIMIT'))!;
		expect(sql).toContain('c.id IN (SELECT vl.id FROM universe.v_contacts vl');
		// Every placeholder has a parameter and every parameter a placeholder: no gaps.
		const placeholders = new Set([...String(sql).matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
		expect(placeholders.size).toBe((params as unknown[]).length);
		expect(Math.max(...placeholders)).toBe((params as unknown[]).length);
		expect(params).toContain('%deli%');
		expect(params).toContain(ORG);
	});

	it('does not filter on an empty group', async () => {
		stubCounts();

		await listAllContacts('u1', ORG, 1, { filters: { operator: 'AND', filters: [] } });

		expect(countCall()[0]).not.toContain('v_contacts');
	});

	it('applies the same search and filters to a schema list and to the map', async () => {
		stubCounts();
		await listSchemaContacts('u1', SCHEMA, 1, { search: 'deli', filters: austin });
		const schemaSql = String(countCall()[0]);

		mockClient.query.mockClear();
		stub(() => ({ rows: [] }));
		await listContactMarkers('u1', ORG, SCHEMA, { search: 'deli', filters: austin });
		const mapSql = String(sqlRun('a.coordinates IS NOT NULL')![0]);

		for (const sql of [schemaSql, mapSql]) {
			expect(sql).toContain('ILIKE');
			expect(sql).toContain('v_contacts');
			expect(sql).toContain('c.schema_id =');
		}
	});

	it('answers 400 for a filter that does not apply to contacts', async () => {
		stubCounts();

		await expect(
			listAllContacts('u1', ORG, 1, {
				filters: { operator: 'AND', filters: [{ item: 'nonsense', operation: 'equals', value: 1 }] }
			})
		).rejects.toMatchObject({ status: 400 });
	});
});
