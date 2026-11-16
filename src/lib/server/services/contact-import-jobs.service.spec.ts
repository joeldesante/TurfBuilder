import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
	class FunctionsNotConfiguredError extends Error {}
	return {
		requireOrgPermission: vi.fn(),
		requireContactImportOrg: vi.fn(),
		requireContactImportJobOrg: vi.fn(),
		invokeFunction: vi.fn(),
		query: vi.fn(),
		FunctionsNotConfiguredError,
		error: vi.fn()
	};
});

vi.mock('$lib/server/list-access', () => ({
	requireOrgPermission: mocks.requireOrgPermission,
	requireContactImportOrg: mocks.requireContactImportOrg,
	requireContactImportJobOrg: mocks.requireContactImportJobOrg
}));
vi.mock('$lib/server/database', () => ({
	withOrgTransaction: (_orgId: string, run: (client: unknown) => unknown) =>
		run({ query: mocks.query })
}));
vi.mock('$lib/server/services/functions.service', () => ({
	invokeFunction: mocks.invokeFunction,
	FunctionsNotConfiguredError: mocks.FunctionsNotConfiguredError
}));
vi.mock('$lib/server/logger', () => ({ logger: { error: mocks.error } }));

import {
	StartContactImportJobSchema,
	getContactImportJob,
	listContactImportJobs,
	startContactImportJob
} from './contact-import-jobs.service';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const IMPORT = '3f1c2b9e-0000-4000-8000-000000000001';
const SCHEMA = '3f1c2b9e-0000-4000-8000-000000000002';
const JOB = '3f1c2b9e-0000-4000-8000-000000000003';

const NAME = '3f1c2b9e-0000-4000-8000-0000000000a1';
const PHONE = '3f1c2b9e-0000-4000-8000-0000000000a2';
const fields = [
	{ id: NAME, name: 'Name', type: 'text', required: true },
	{ id: PHONE, name: 'Phone', type: 'text', required: false }
];
const mapping = { [NAME]: 0, 'contact.latitude': 3, 'contact.longitude': 4 };
const input = { schemaId: SCHEMA, mapping };

const jobRow = {
	id: JOB,
	file_id: IMPORT,
	file_name: 'people.csv',
	status: 'queued',
	rows_total: 400000,
	rows_processed: 0,
	rows_skipped: 0,
	error: null,
	created_at: new Date('2026-11-15T18:00:00.000Z'),
	started_at: null,
	updated_at: new Date('2026-11-15T18:00:00.000Z'),
	finished_at: null
};

/** The five queries a start makes, in order. Override one to change what it finds. */
function startQueries(over: { file?: unknown[]; fields?: unknown[]; running?: unknown[] } = {}) {
	mocks.query
		.mockResolvedValueOnce({ rows: over.file ?? [{ row_count: 400000 }] })
		.mockResolvedValueOnce({ rows: over.fields ?? fields })
		.mockResolvedValueOnce({ rows: over.running ?? [] })
		.mockResolvedValueOnce({ rows: [{ id: JOB }] })
		.mockResolvedValueOnce({ rows: [jobRow] });
}

beforeEach(() => {
	vi.resetAllMocks();
	mocks.requireOrgPermission.mockResolvedValue(undefined);
	mocks.requireContactImportOrg.mockResolvedValue(ORG);
	mocks.requireContactImportJobOrg.mockResolvedValue(ORG);
	mocks.invokeFunction.mockResolvedValue({ activationId: 'act' });
});

describe('StartContactImportJobSchema', () => {
	it('wants a schema id and whole column positions', () => {
		expect(StartContactImportJobSchema.safeParse(input).success).toBe(true);
		expect(StartContactImportJobSchema.safeParse({ ...input, schemaId: 'x' }).success).toBe(false);
		expect(StartContactImportJobSchema.safeParse({ ...input, mapping: { a: 1.5 } }).success).toBe(
			false
		);
	});
});

describe('startContactImportJob', () => {
	it('saves the job first, then calls the function, and answers the queued job', async () => {
		startQueries();

		const job = await startContactImportJob('u1', IMPORT, input);

		expect(job).toMatchObject({ id: JOB, status: 'queued', file_name: 'people.csv' });
		expect(mocks.invokeFunction).toHaveBeenCalledWith('import-contacts', {
			orgId: ORG,
			jobId: JOB
		});
		const insert = mocks.query.mock.calls.findIndex(([sql]) =>
			String(sql).includes('INSERT INTO universe.contact_import_job')
		);
		expect(insert).toBeGreaterThanOrEqual(0);
		expect(mocks.query.mock.invocationCallOrder[insert]).toBeLessThan(
			mocks.invokeFunction.mock.invocationCallOrder[0]
		);
	});

	it('stores the schema, the mapping and the row count with the job', async () => {
		startQueries();

		await startContactImportJob('u1', IMPORT, input);

		const [, params] = mocks.query.mock.calls.find(([sql]) =>
			String(sql).includes('INSERT INTO universe.contact_import_job')
		)!;
		expect(params).toEqual([ORG, IMPORT, SCHEMA, JSON.stringify(mapping), 400000, 'u1']);
	});

	it('answers 404 when the file is not ready, and starts nothing', async () => {
		mocks.query.mockResolvedValueOnce({ rows: [] });

		await expect(startContactImportJob('u1', IMPORT, input)).rejects.toMatchObject({
			status: 404
		});
		expect(mocks.invokeFunction).not.toHaveBeenCalled();
	});

	it('answers 400 when the schema is not the organization', async () => {
		startQueries({ fields: [] });

		await expect(startContactImportJob('u1', IMPORT, input)).rejects.toMatchObject({
			status: 400
		});
		expect(mocks.invokeFunction).not.toHaveBeenCalled();
	});

	it('answers 400 when the mapping names a field the schema does not have', async () => {
		startQueries();

		await expect(
			startContactImportJob('u1', IMPORT, { ...input, mapping: { ...mapping, nope: 2 } })
		).rejects.toMatchObject({ status: 400 });
		expect(mocks.invokeFunction).not.toHaveBeenCalled();
	});

	it('answers 400 when a required field has no column', async () => {
		startQueries();

		await expect(
			startContactImportJob('u1', IMPORT, {
				...input,
				mapping: { 'contact.latitude': 3, 'contact.longitude': 4 }
			})
		).rejects.toMatchObject({ status: 400, body: { message: 'Name needs a column' } });
		expect(mocks.invokeFunction).not.toHaveBeenCalled();
	});

	it('answers 409 when the file is already being imported', async () => {
		startQueries({ running: [{}] });

		await expect(startContactImportJob('u1', IMPORT, input)).rejects.toMatchObject({
			status: 409
		});
		expect(mocks.invokeFunction).not.toHaveBeenCalled();
	});

	it('marks the job failed and answers 503 when the function cannot be started', async () => {
		startQueries();
		mocks.query.mockResolvedValueOnce({ rows: [] });
		mocks.invokeFunction.mockRejectedValue(new Error('boom'));

		await expect(startContactImportJob('u1', IMPORT, input)).rejects.toMatchObject({
			status: 503,
			body: { message: 'The import could not be started. Try again shortly.' }
		});

		const [sql, params] = mocks.query.mock.calls.at(-1)!;
		expect(String(sql)).toContain("SET status = 'failed'");
		expect(params).toEqual([JOB, ORG, 'The import could not be started. Try again shortly.']);
	});

	it('says imports are not set up when the functions are not configured', async () => {
		startQueries();
		mocks.query.mockResolvedValueOnce({ rows: [] });
		mocks.invokeFunction.mockRejectedValue(new mocks.FunctionsNotConfiguredError());

		await expect(startContactImportJob('u1', IMPORT, input)).rejects.toMatchObject({
			status: 503,
			body: { message: 'Imports are not set up on this server yet.' }
		});
	});

	it('checks staff access first', async () => {
		mocks.requireOrgPermission.mockRejectedValue({ status: 403 });

		await expect(startContactImportJob('u1', IMPORT, input)).rejects.toMatchObject({
			status: 403
		});
		expect(mocks.query).not.toHaveBeenCalled();
	});
});

describe('listContactImportJobs', () => {
	it('lists the organization jobs with dates as strings', async () => {
		mocks.query.mockResolvedValue({ rows: [jobRow] });

		const jobs = await listContactImportJobs('u1', ORG);

		expect(mocks.requireOrgPermission).toHaveBeenCalledWith('u1', ORG, 'system.access');
		expect(jobs).toEqual([
			{
				id: JOB,
				file_id: IMPORT,
				file_name: 'people.csv',
				status: 'queued',
				rows_total: 400000,
				rows_processed: 0,
				rows_skipped: 0,
				error: null,
				created_at: '2026-11-15T18:00:00.000Z',
				started_at: null,
				updated_at: '2026-11-15T18:00:00.000Z',
				finished_at: null
			}
		]);
		expect(String(mocks.query.mock.calls[0][0])).toContain('j.org_id = $1');
	});
});

describe('getContactImportJob', () => {
	it('answers the job', async () => {
		mocks.query.mockResolvedValue({
			rows: [{ ...jobRow, rows_processed: 500, status: 'running' }]
		});

		const job = await getContactImportJob('u1', JOB);

		expect(mocks.requireContactImportJobOrg).toHaveBeenCalledWith('u1', JOB);
		expect(job).toMatchObject({ rows_processed: 500, status: 'running' });
	});

	it('answers 404 when the row is gone', async () => {
		mocks.query.mockResolvedValue({ rows: [] });

		await expect(getContactImportJob('u1', JOB)).rejects.toMatchObject({ status: 404 });
	});
});
