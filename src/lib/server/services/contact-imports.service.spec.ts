import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
	class StorageNotConfiguredError extends Error {}
	return {
		requireOrgPermission: vi.fn(),
		requireContactImportOrg: vi.fn(),
		presignContactImportUpload: vi.fn(),
		presignContactImportDownload: vi.fn(),
		isStorageConfigured: vi.fn(),
		query: vi.fn(),
		StorageNotConfiguredError,
		warn: vi.fn()
	};
});

vi.mock('$lib/server/list-access', () => ({
	requireOrgPermission: mocks.requireOrgPermission,
	requireContactImportOrg: mocks.requireContactImportOrg
}));
vi.mock('$lib/server/database', () => ({
	withOrgTransaction: (_orgId: string, run: (client: unknown) => unknown) =>
		run({ query: mocks.query })
}));
vi.mock('$lib/server/storage', () => ({
	presignContactImportUpload: mocks.presignContactImportUpload,
	presignContactImportDownload: mocks.presignContactImportDownload,
	isStorageConfigured: mocks.isStorageConfigured,
	StorageNotConfiguredError: mocks.StorageNotConfiguredError
}));
vi.mock('$lib/server/logger', () => ({ logger: { warn: mocks.warn } }));

import {
	CompleteContactImportSchema,
	ContactImportUploadSchema,
	archiveContactImport,
	completeContactImport,
	createContactImportUpload,
	getContactImportDownload,
	IMPORT_RETENTION_DAYS,
	isContactImportAvailable,
	listContactImports
} from './contact-imports.service';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const IMPORT = '3f1c2b9e-0000-4000-8000-000000000001';
const KEY = `orgs/${ORG}/contact-imports/${IMPORT}.csv`;
const input = { fileName: 'people.csv', contentLength: 120_000 };

const row = {
	id: IMPORT,
	file_name: 'people.csv',
	size_bytes: 120_000,
	row_count: 1500,
	created_at: new Date('2026-11-15T14:00:00.000Z'),
	expires_at: new Date('2026-12-15T14:00:00.000Z'),
	preserved: false
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireOrgPermission.mockResolvedValue(undefined);
	mocks.requireContactImportOrg.mockResolvedValue(ORG);
	mocks.presignContactImportUpload.mockResolvedValue({
		url: 'https://signed.example/put',
		key: KEY
	});
	mocks.query.mockResolvedValue({ rows: [row] });
	mocks.presignContactImportDownload.mockResolvedValue('https://signed.example/get');
});

describe('ContactImportUploadSchema', () => {
	it('accepts a name and a size within the cap', () => {
		expect(ContactImportUploadSchema.safeParse(input).success).toBe(true);
	});

	it.each([
		['a size over the cap', { ...input, contentLength: 90_000_000 }],
		['a size of zero', { ...input, contentLength: 0 }],
		['no size', { fileName: 'people.csv' }],
		['a blank name', { ...input, fileName: '   ' }],
		['no name', { contentLength: 100 }],
		['a very long name', { ...input, fileName: 'a'.repeat(300) }]
	])('refuses %s', (_name, body) => {
		expect(ContactImportUploadSchema.safeParse(body).success).toBe(false);
	});
});

const index = (rowCount: number, offsets: number[]) => ({
	rowCount,
	rowIndex: { interval: 1000 as const, offsets }
});

describe('CompleteContactImportSchema', () => {
	it('accepts a row count with its index', () => {
		expect(CompleteContactImportSchema.safeParse(index(0, [])).success).toBe(true);
		expect(CompleteContactImportSchema.safeParse(index(1, [40])).success).toBe(true);
		expect(CompleteContactImportSchema.safeParse(index(1000, [40])).success).toBe(true);
		expect(CompleteContactImportSchema.safeParse(index(1001, [40, 9000])).success).toBe(true);
		expect(
			CompleteContactImportSchema.safeParse(
				index(
					300_000,
					Array.from({ length: 300 }, (_, i) => 40 + i * 30_000)
				)
			).success
		).toBe(true);
	});

	it.each([
		['a negative row count', index(-1, [])],
		['a fractional row count', index(1.5, [40])],
		['no row count', { rowIndex: { interval: 1000, offsets: [] } }],
		['no index', { rowCount: 5 }],
		['another interval', { rowCount: 5, rowIndex: { interval: 10, offsets: [40] } }],
		['too few offsets for the rows', index(2500, [40, 9000])],
		['too many offsets for the rows', index(500, [40, 9000])],
		['offsets that stand still', index(2001, [40, 40, 9000])],
		['offsets that go backwards', index(2001, [40, 9000, 500])],
		['a negative offset', index(1, [-5])],
		['a fractional offset', index(1, [4.5])]
	])('refuses %s', (_name, body) => {
		expect(CompleteContactImportSchema.safeParse(body).success).toBe(false);
	});
});

describe('createContactImportUpload', () => {
	it('records the file and signs an upload for staff of the org', async () => {
		const result = await createContactImportUpload('u1', ORG, input);

		expect(result).toEqual({ id: expect.any(String), url: 'https://signed.example/put', key: KEY });
		expect(mocks.requireOrgPermission).toHaveBeenCalledWith('u1', ORG, 'system.access');
		expect(mocks.presignContactImportUpload).toHaveBeenCalledWith(ORG, result.id, 120_000);
		const [sql, params] = mocks.query.mock.calls[0];
		expect(sql).toContain('INSERT INTO universe.contact_import_file');
		expect(params).toEqual([
			result.id,
			ORG,
			KEY,
			'people.csv',
			120_000,
			'u1',
			IMPORT_RETENTION_DAYS
		]);
	});

	it('signs and records nothing without staff access', async () => {
		mocks.requireOrgPermission.mockRejectedValue({ status: 403 });

		await expect(createContactImportUpload('u1', ORG, input)).rejects.toMatchObject({
			status: 403
		});
		expect(mocks.presignContactImportUpload).not.toHaveBeenCalled();
		expect(mocks.query).not.toHaveBeenCalled();
	});

	it('answers 503 and records nothing when storage is not set up', async () => {
		mocks.presignContactImportUpload.mockRejectedValue(
			new mocks.StorageNotConfiguredError('Storage is not set up.')
		);

		await expect(createContactImportUpload('u1', ORG, input)).rejects.toMatchObject({
			status: 503,
			body: { message: 'Storage is not set up.' }
		});
		expect(mocks.query).not.toHaveBeenCalled();
	});

	it('does not put the file name in the log', async () => {
		mocks.presignContactImportUpload.mockRejectedValue(
			new mocks.StorageNotConfiguredError('Storage is not set up.')
		);
		await createContactImportUpload('u1', ORG, input).catch(() => {});

		expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain('people.csv');
	});
});

describe('completeContactImport', () => {
	/** Answers the size lookup, then the update. */
	function answers(size = 120_000, updated: unknown[] = [row]) {
		mocks.query.mockImplementation(async (sql: string) =>
			sql.includes('SELECT size_bytes') ? { rows: [{ size_bytes: size }] } : { rows: updated }
		);
	}

	it('marks the file ready with its rows and index and answers it as the list shows it', async () => {
		answers();

		const file = await completeContactImport('u1', IMPORT, index(1500, [40, 41_000]));

		expect(file).toEqual({
			id: IMPORT,
			file_name: 'people.csv',
			size_bytes: 120_000,
			row_count: 1500,
			uploaded_at: '2026-11-15T14:00:00.000Z',
			expires_at: '2026-12-15T14:00:00.000Z',
			preserved: false
		});
		const [sql, params] = mocks.query.mock.calls[1];
		expect(sql).toContain('row_offsets = $5::bigint[]');
		expect(params).toEqual([IMPORT, ORG, 1500, 1000, [40, 41_000]]);
		expect(mocks.requireOrgPermission).toHaveBeenCalledWith('u1', ORG, 'system.access');
	});

	it('does not send the index back in the file the list shows', async () => {
		answers();

		expect(await completeContactImport('u1', IMPORT, index(1, [40]))).not.toHaveProperty(
			'row_offsets'
		);
	});

	it('answers 400, and saves nothing, when an offset is not inside the file', async () => {
		answers(5000);

		await expect(
			completeContactImport('u1', IMPORT, index(1001, [40, 5000]))
		).rejects.toMatchObject({ status: 400 });
		expect(mocks.query.mock.calls.some((c) => String(c[0]).includes('UPDATE'))).toBe(false);
	});

	it('accepts an offset just short of the end of the file', async () => {
		answers(5000);

		await expect(
			completeContactImport('u1', IMPORT, index(1001, [40, 4999]))
		).resolves.toBeDefined();
	});

	it('saves an empty index for a file with no rows', async () => {
		answers();

		await completeContactImport('u1', IMPORT, index(0, []));

		expect(mocks.query.mock.calls[1][1]).toEqual([IMPORT, ORG, 0, 1000, []]);
	});

	it("answers 404 when the import is not in the caller's organizations", async () => {
		mocks.requireContactImportOrg.mockRejectedValue({ status: 404 });

		await expect(completeContactImport('u1', IMPORT, index(0, []))).rejects.toMatchObject({
			status: 404
		});
		expect(mocks.query).not.toHaveBeenCalled();
	});

	it('answers 404 when the file is not there', async () => {
		mocks.query.mockResolvedValue({ rows: [] });

		await expect(completeContactImport('u1', IMPORT, index(0, []))).rejects.toMatchObject({
			status: 404
		});
	});

	it('answers 403 without staff access, and saves nothing', async () => {
		mocks.requireOrgPermission.mockRejectedValue({ status: 403 });

		await expect(completeContactImport('u1', IMPORT, index(0, []))).rejects.toMatchObject({
			status: 403
		});
		expect(mocks.query).not.toHaveBeenCalled();
	});
});

describe('archiveContactImport', () => {
	beforeEach(() => {
		mocks.query.mockResolvedValue({ rowCount: 1, rows: [] });
	});

	it('marks the file deleted, and leaves the file in storage', async () => {
		await archiveContactImport('u1', IMPORT);

		const [sql, params] = mocks.query.mock.calls[0];
		expect(sql).toContain('UPDATE universe.contact_import_file SET deleted_at = now()');
		expect(sql).toContain('deleted_at IS NULL');
		expect(params).toEqual([IMPORT, ORG]);
		expect(mocks.query.mock.calls.some((c) => /DELETE FROM/.test(String(c[0])))).toBe(false);
		expect(mocks.presignContactImportDownload).not.toHaveBeenCalled();
		expect(mocks.presignContactImportUpload).not.toHaveBeenCalled();
	});

	it("needs staff access to the file's organization", async () => {
		await archiveContactImport('u1', IMPORT);

		expect(mocks.requireContactImportOrg).toHaveBeenCalledWith('u1', IMPORT);
		expect(mocks.requireOrgPermission).toHaveBeenCalledWith('u1', ORG, 'system.access');
	});

	it("answers 404 when the file is in none of the caller's organizations, and changes nothing", async () => {
		mocks.requireContactImportOrg.mockRejectedValue({ status: 404 });

		await expect(archiveContactImport('u1', IMPORT)).rejects.toMatchObject({ status: 404 });
		expect(mocks.query).not.toHaveBeenCalled();
	});

	it('answers 404 when the file is already archived', async () => {
		mocks.query.mockResolvedValue({ rowCount: 0, rows: [] });

		await expect(archiveContactImport('u1', IMPORT)).rejects.toMatchObject({ status: 404 });
	});

	it('answers 403 without staff access, and changes nothing', async () => {
		mocks.requireOrgPermission.mockRejectedValue({ status: 403 });

		await expect(archiveContactImport('u1', IMPORT)).rejects.toMatchObject({ status: 403 });
		expect(mocks.query).not.toHaveBeenCalled();
	});
});

describe('listContactImports', () => {
	it('lists the finished uploads of the org, newest first', async () => {
		const files = await listContactImports('u1', ORG);

		expect(files).toHaveLength(1);
		expect(files[0].uploaded_at).toBe('2026-11-15T14:00:00.000Z');
		const [sql, params] = mocks.query.mock.calls[0];
		expect(sql).toContain("status = 'ready'");
		expect(sql).toContain('deleted_at IS NULL');
		expect(sql).toContain('ORDER BY created_at DESC');
		expect(params[0]).toBe(ORG);
	});

	it('keeps a file with no row count', async () => {
		mocks.query.mockResolvedValue({ rows: [{ ...row, row_count: null }] });

		expect((await listContactImports('u1', ORG))[0].row_count).toBeNull();
	});

	it('lists nothing without staff access', async () => {
		mocks.requireOrgPermission.mockRejectedValue({ status: 403 });

		await expect(listContactImports('u1', ORG)).rejects.toMatchObject({ status: 403 });
		expect(mocks.query).not.toHaveBeenCalled();
	});
});

describe('getContactImportDownloadUrl', () => {
	beforeEach(() => {
		mocks.query.mockResolvedValue({
			rows: [{ storage_key: KEY, row_index_interval: 1000, row_offsets: [40, 41_000] }]
		});
	});

	it('signs a read of the stored file, and gives the row index, for staff of its org', async () => {
		expect(await getContactImportDownload('u1', IMPORT)).toEqual({
			url: 'https://signed.example/get',
			rowIndex: { interval: 1000, offsets: [40, 41_000] }
		});

		expect(mocks.requireContactImportOrg).toHaveBeenCalledWith('u1', IMPORT);
		expect(mocks.requireOrgPermission).toHaveBeenCalledWith('u1', ORG, 'system.access');
		expect(mocks.presignContactImportDownload).toHaveBeenCalledWith(KEY);
		const [sql, params] = mocks.query.mock.calls[0];
		expect(sql).toContain("status = 'ready'");
		expect(sql).toContain('deleted_at IS NULL');
		expect(params).toEqual([IMPORT, ORG]);
	});

	it("answers 404 for an import in none of the caller's organizations, and signs nothing", async () => {
		mocks.requireContactImportOrg.mockRejectedValue({ status: 404 });

		await expect(getContactImportDownload('u1', IMPORT)).rejects.toMatchObject({ status: 404 });
		expect(mocks.presignContactImportDownload).not.toHaveBeenCalled();
	});

	it('answers 403 without staff access, and signs nothing', async () => {
		mocks.requireOrgPermission.mockRejectedValue({ status: 403 });

		await expect(getContactImportDownload('u1', IMPORT)).rejects.toMatchObject({ status: 403 });
		expect(mocks.presignContactImportDownload).not.toHaveBeenCalled();
	});

	it('gives no row index for a file the browser never indexed', async () => {
		mocks.query.mockResolvedValue({
			rows: [{ storage_key: KEY, row_index_interval: null, row_offsets: null }]
		});

		expect((await getContactImportDownload('u1', IMPORT)).rowIndex).toBeNull();
	});

	it('answers 404 for a file that has not finished uploading', async () => {
		mocks.query.mockResolvedValue({ rows: [] });

		await expect(getContactImportDownload('u1', IMPORT)).rejects.toMatchObject({ status: 404 });
		expect(mocks.presignContactImportDownload).not.toHaveBeenCalled();
	});

	it('answers 503 when storage is not set up', async () => {
		mocks.presignContactImportDownload.mockRejectedValue(
			new mocks.StorageNotConfiguredError('Storage is not set up.')
		);

		await expect(getContactImportDownload('u1', IMPORT)).rejects.toMatchObject({
			status: 503,
			body: { message: 'Storage is not set up.' }
		});
	});
});

describe('isContactImportAvailable', () => {
	it('is true when storage is set up', async () => {
		mocks.isStorageConfigured.mockResolvedValue(true);

		expect(await isContactImportAvailable('u1', ORG)).toBe(true);
		expect(mocks.requireOrgPermission).toHaveBeenCalledWith('u1', ORG, 'system.access');
	});

	it('is false when storage is not set up', async () => {
		mocks.isStorageConfigured.mockResolvedValue(false);

		expect(await isContactImportAvailable('u1', ORG)).toBe(false);
	});

	it('does not look at storage without staff access', async () => {
		mocks.requireOrgPermission.mockRejectedValue({ status: 403 });

		await expect(isContactImportAvailable('u1', ORG)).rejects.toMatchObject({ status: 403 });
		expect(mocks.isStorageConfigured).not.toHaveBeenCalled();
	});
});
