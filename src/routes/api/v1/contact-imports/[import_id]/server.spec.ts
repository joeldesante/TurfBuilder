import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => ({ completeContactImport: vi.fn(), archiveContactImport: vi.fn() }));

vi.mock('$lib/server/services/contact-imports.service', () => ({
	completeContactImport: mocks.completeContactImport,
	archiveContactImport: mocks.archiveContactImport,
	CompleteContactImportSchema: z.object({
		rowCount: z.number().int().min(0),
		rowIndex: z.object({ interval: z.literal(1000), offsets: z.array(z.number().int().min(0)) })
	})
}));

import { DELETE, PATCH } from './+server';

const IMPORT = '3f1c2b9e-0000-4000-8000-000000000001';
const index = (rowCount: number) => ({ rowCount, rowIndex: { interval: 1000, offsets: [40] } });

function call(payload: unknown, locals: unknown = { user: { id: 'u1' } }, id = IMPORT) {
	const request = new Request('http://localhost/api/v1/contact-imports/x', {
		method: 'PATCH',
		body: JSON.stringify(payload)
	});
	return Promise.resolve().then(() =>
		PATCH({ params: { import_id: id }, locals, request } as never)
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.completeContactImport.mockResolvedValue({ id: IMPORT, row_count: 12 });
});

describe('PATCH /api/v1/contact-imports/[import_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(call(index(1), { user: null })).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for an id that is not an id', async () => {
		await expect(call(index(1), undefined, 'nope')).rejects.toMatchObject({ status: 400 });
	});

	it('answers 400 for a bad row count, and changes nothing', async () => {
		await expect(call({ ...index(1), rowCount: -3 })).rejects.toMatchObject({ status: 400 });
		expect(mocks.completeContactImport).not.toHaveBeenCalled();
	});

	it('answers 400 when the index is missing', async () => {
		await expect(call({ rowCount: 5 })).rejects.toMatchObject({ status: 400 });
		expect(mocks.completeContactImport).not.toHaveBeenCalled();
	});

	it('answers the file with its row count', async () => {
		const response = await call(index(12));

		expect(await response.json()).toEqual({ id: IMPORT, row_count: 12 });
		expect(mocks.completeContactImport).toHaveBeenCalledWith('u1', IMPORT, index(12));
	});
});

describe('DELETE /api/v1/contact-imports/[import_id]', () => {
	const remove = (locals: unknown = { user: { id: 'u1' } }, id = IMPORT) =>
		Promise.resolve().then(() => DELETE({ params: { import_id: id }, locals } as never));

	it('answers 401 when signed out', async () => {
		await expect(remove({ user: null })).rejects.toMatchObject({ status: 401 });
		expect(mocks.archiveContactImport).not.toHaveBeenCalled();
	});

	it('answers 400 for an id that is not an id', async () => {
		await expect(remove(undefined, 'nope')).rejects.toMatchObject({ status: 400 });
		expect(mocks.archiveContactImport).not.toHaveBeenCalled();
	});

	it('answers 204 with no body after archiving the file', async () => {
		mocks.archiveContactImport.mockResolvedValue(undefined);

		const response = await remove();

		expect(response.status).toBe(204);
		expect(await response.text()).toBe('');
		expect(mocks.archiveContactImport).toHaveBeenCalledWith('u1', IMPORT);
	});

	it('passes on a 404 from the service', async () => {
		mocks.archiveContactImport.mockRejectedValue({ status: 404 });

		await expect(remove()).rejects.toMatchObject({ status: 404 });
	});
});
