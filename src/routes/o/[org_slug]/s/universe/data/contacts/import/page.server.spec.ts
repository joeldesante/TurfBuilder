import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
	isContactImportAvailable: vi.fn(),
	listContactImports: vi.fn(),
	listContactSchemas: vi.fn()
}));

vi.mock('$lib/server/services/contact-imports.service', () => ({
	isContactImportAvailable: mocks.isContactImportAvailable,
	listContactImports: mocks.listContactImports
}));

vi.mock('$lib/server/services/contact-schemas.service', () => ({
	listContactSchemas: mocks.listContactSchemas
}));

import { load } from './+page.server';

const locals = { user: { id: 'u1' }, organization: { id: 'o1' } };
const run = (l: unknown, query = '') =>
	Promise.resolve().then(() =>
		load({ locals: l, url: new URL(`http://localhost/import${query}`), depends } as never)
	);

const FILE = '3f1c2b9e-0000-4000-8000-000000000001';
const SCHEMA = '11111111-1111-4111-8111-111111111111';
const FIELD = '22222222-2222-4222-8222-222222222222';

const depends = vi.fn();

beforeEach(() => {
	vi.clearAllMocks();
	mocks.isContactImportAvailable.mockResolvedValue(true);
	mocks.listContactSchemas.mockResolvedValue([{ id: 's1' }]);
	mocks.listContactImports.mockResolvedValue([{ id: 'i1' }]);
});

describe('contacts import page load', () => {
	it('registers its data under a key of its own, so it can be read again without the layouts', async () => {
		await run(locals);

		expect(depends).toHaveBeenCalledWith('app:contact-imports');
	});

	it('answers 401 when signed out', async () => {
		await expect(run({ ...locals, user: null })).rejects.toMatchObject({ status: 401 });
	});

	it('answers 404 without an organization', async () => {
		await expect(run({ ...locals, organization: null })).rejects.toMatchObject({ status: 404 });
	});

	it('says imports are available when storage is set up', async () => {
		expect(await run(locals)).toEqual({
			available: true,
			schemas: [{ id: 's1' }],
			imports: [{ id: 'i1' }],
			restore: null
		});
		expect(mocks.isContactImportAvailable).toHaveBeenCalledWith('u1', 'o1');
		expect(mocks.listContactSchemas).toHaveBeenCalledWith('u1', 'o1');
		expect(mocks.listContactImports).toHaveBeenCalledWith('u1', 'o1');
	});

	it('says imports are not available when storage is not set up', async () => {
		mocks.isContactImportAvailable.mockResolvedValue(false);

		expect(await run(locals)).toEqual({
			available: false,
			schemas: [{ id: 's1' }],
			imports: [],
			restore: null
		});
		expect(mocks.listContactImports).not.toHaveBeenCalled();
	});

	describe('picking up where the person was, from the address', () => {
		beforeEach(() => {
			mocks.listContactImports.mockResolvedValue([{ id: FILE }]);
		});

		it('has nothing to restore without a file in the address', async () => {
			expect(
				(await run(locals, `?tab=spreadsheet&schema=${SCHEMA}`)) as { restore: unknown }
			).toMatchObject({
				restore: null
			});
		});

		it('restores the file, tab, schema and mapping from the address', async () => {
			const result = (await run(
				locals,
				`?file=${FILE}&tab=spreadsheet&schema=${SCHEMA}&m=${FIELD},`
			)) as { restore: unknown };

			expect(result.restore).toEqual({
				fileId: FILE,
				tab: 'spreadsheet',
				schemaId: SCHEMA,
				mapping: [FIELD, '']
			});
		});

		it('restores nothing for a file that is no longer listed', async () => {
			mocks.listContactImports.mockResolvedValue([{ id: 'someone-elses' }]);

			expect(((await run(locals, `?file=${FILE}`)) as { restore: unknown }).restore).toBeNull();
		});

		it('restores nothing for a file id that is not an id', async () => {
			expect(((await run(locals, '?file=nope')) as { restore: unknown }).restore).toBeNull();
		});

		it('restores nothing when imports are not available', async () => {
			mocks.isContactImportAvailable.mockResolvedValue(false);

			expect(((await run(locals, `?file=${FILE}`)) as { restore: unknown }).restore).toBeNull();
		});
	});
});
