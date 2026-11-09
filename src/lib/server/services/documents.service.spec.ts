import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
	client: { query: vi.fn() },
	requireListOrg: vi.fn(async () => 'org-1'),
	requireDocumentOrg: vi.fn(async () => ({ orgId: 'org-1', listId: 'list-1' })),
	requireListAccess: vi.fn(async () => ({ name: 'Ward 5: Doors / Spring!' })),
	generateListDocument: vi.fn(async () => undefined),
	presign: vi.fn(async () => 'https://storage/signed')
}));

vi.mock('$lib/server/database', () => ({
	withOrgTransaction: async (_org: string, fn: (c: unknown) => unknown) => fn(m.client)
}));
vi.mock('$lib/server/list-access', () => ({
	requireListOrg: m.requireListOrg,
	requireDocumentOrg: m.requireDocumentOrg,
	requireListAccess: m.requireListAccess
}));
vi.mock('./list-document.service', () => ({ generateListDocument: m.generateListDocument }));
vi.mock('$lib/server/storage', () => ({
	listDocumentKey: (org: string, list: string, id: string) =>
		`orgs/${org}/lists/${list}/documents/${id}.pdf`,
	presignDocumentDownload: m.presign
}));

import { createDocument, deleteDocument, getDocument, listDocuments } from './documents.service';

const forbidden = () => Object.assign(new Error('Forbidden'), { status: 403 });

beforeEach(() => {
	vi.clearAllMocks();
	m.client.query.mockResolvedValue({ rowCount: 1, rows: [] });
});

describe('every operation', () => {
	it.each([
		['listDocuments', () => listDocuments('u1', 'list-1')],
		['createDocument', () => createDocument('u1', 'list-1')],
		['getDocument', () => getDocument('u1', 'doc-1')],
		['deleteDocument', () => deleteDocument('u1', 'doc-1')]
	])('%s answers 403 without list access and changes nothing', async (_name, run) => {
		m.requireListAccess.mockRejectedValueOnce(forbidden());

		await expect(run()).rejects.toMatchObject({ status: 403 });
		expect(m.client.query).not.toHaveBeenCalled();
		expect(m.generateListDocument).not.toHaveBeenCalled();
	});
});

describe('createDocument', () => {
	it('reserves the storage key, supersedes the older documents, and starts generating', async () => {
		m.client.query.mockImplementation(async (sql: string, values: unknown[]) =>
			sql.startsWith('INSERT')
				? {
						rows: [
							{
								id: values[0],
								list_id: 'list-1',
								storage_key: values[3],
								status: 'pending',
								created_at: 'now'
							}
						]
					}
				: { rowCount: 2, rows: [] }
		);

		const doc = await createDocument('u1', 'list-1', { timeZone: 'America/New_York' });

		const [insertSql, insertValues] = m.client.query.mock.calls[0];
		expect(insertSql).toContain('INSERT INTO universe.list_document');
		expect(insertValues[3]).toBe(`orgs/org-1/lists/list-1/documents/${doc.id}.pdf`);
		const [updateSql, updateValues] = m.client.query.mock.calls[1];
		expect(updateSql).toContain('superseded_by');
		expect(updateValues).toEqual(['list-1', 'org-1', doc.id]);
		expect(m.generateListDocument).toHaveBeenCalledWith({
			orgId: 'org-1',
			documentId: doc.id,
			listId: 'list-1',
			storageKey: insertValues[3],
			timeZone: 'America/New_York'
		});
		expect(doc).not.toHaveProperty('storage_key');
	});
});

describe('getDocument', () => {
	it('answers 404 for a deleted document', async () => {
		m.client.query.mockResolvedValue({ rowCount: 0, rows: [] });

		await expect(getDocument('u1', 'doc-1')).rejects.toMatchObject({ status: 404 });
	});

	it('gives a download link named after the list once ready, and none before', async () => {
		const row = { id: 'doc-1', list_id: 'list-1', storage_key: 'k', status: 'ready', error: null };
		m.client.query.mockResolvedValue({ rowCount: 1, rows: [row] });

		const ready = await getDocument('u1', 'doc-1');
		expect(ready.download_url).toBe('https://storage/signed');
		expect(m.presign).toHaveBeenCalledWith('k', 'Ward 5 Doors  Spring.pdf');
		expect(ready).not.toHaveProperty('storage_key');

		m.client.query.mockResolvedValue({ rowCount: 1, rows: [{ ...row, status: 'pending' }] });
		expect((await getDocument('u1', 'doc-1')).download_url).toBeNull();
	});
});

describe('deleteDocument', () => {
	it('soft-deletes within the org, and answers 404 when already gone', async () => {
		await deleteDocument('u1', 'doc-1');
		expect(m.client.query.mock.calls[0][1]).toEqual(['doc-1', 'list-1', 'org-1']);

		m.client.query.mockResolvedValue({ rowCount: 0, rows: [] });
		await expect(deleteDocument('u1', 'doc-1')).rejects.toMatchObject({ status: 404 });
	});
});

describe('listDocuments', () => {
	it("lists the list's current documents in its org", async () => {
		m.client.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 'doc-1' }] });

		expect(await listDocuments('u1', 'list-1')).toEqual([{ id: 'doc-1' }]);
		const [sql, values] = m.client.query.mock.calls[0];
		expect(sql).toContain('deleted_at IS NULL');
		expect(values).toEqual(['list-1', 'org-1']);
	});
});
