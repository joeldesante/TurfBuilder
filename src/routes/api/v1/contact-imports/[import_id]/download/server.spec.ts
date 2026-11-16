import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ getContactImportDownload: vi.fn() }));

vi.mock('$lib/server/services/contact-imports.service', () => ({
	getContactImportDownload: mocks.getContactImportDownload
}));

import { GET } from './+server';

const IMPORT = '3f1c2b9e-0000-4000-8000-000000000001';

function call(locals: unknown = { user: { id: 'u1' } }, id = IMPORT) {
	return Promise.resolve().then(() => GET({ params: { import_id: id }, locals } as never));
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getContactImportDownload.mockResolvedValue({
		url: 'https://signed.example/get',
		rowIndex: { interval: 1000, offsets: [40, 41_000] }
	});
});

describe('GET /api/v1/contact-imports/[import_id]/download', () => {
	it('answers a null row index for a file with none', async () => {
		mocks.getContactImportDownload.mockResolvedValue({ url: 'u', rowIndex: null });

		expect(await (await call()).json()).toEqual({ url: 'u', row_index: null });
	});

	it('answers 401 when signed out', async () => {
		await expect(call({ user: null })).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for an id that is not an id', async () => {
		await expect(call(undefined, 'nope')).rejects.toMatchObject({ status: 400 });
		expect(mocks.getContactImportDownload).not.toHaveBeenCalled();
	});

	it('answers the link and the row index', async () => {
		const response = await call();

		expect(await response.json()).toEqual({
			url: 'https://signed.example/get',
			row_index: { interval: 1000, offsets: [40, 41_000] }
		});
		expect(mocks.getContactImportDownload).toHaveBeenCalledWith('u1', IMPORT);
	});
});
