import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const mocks = vi.hoisted(() => ({
	pool: { query: vi.fn() },
	requireInfraPermission: vi.fn(),
	audit: vi.fn(),
	deliverEmail: vi.fn(),
	isMailConfigured: vi.fn(),
	testStorage: vi.fn()
}));

vi.mock('$lib/server/database', () => ({ POOL: mocks.pool }));
vi.mock('$lib/server/permissions', () => ({ requireInfraPermission: mocks.requireInfraPermission }));
vi.mock('$lib/server/mail', () => ({ deliverEmail: mocks.deliverEmail, isMailConfigured: mocks.isMailConfigured }));
vi.mock('$lib/server/storage', () => ({
	testStorage: mocks.testStorage,
	StorageNotConfiguredError: class StorageNotConfiguredError extends Error {
		constructor() {
			super('Storage is not set up.');
		}
	}
}));
vi.mock('./audit.service', () => ({ audit: mocks.audit }));

import { sendTestMail, testStorageConnection } from './system-tests.service';
import { StorageNotConfiguredError } from '$lib/server/storage';

const ADMIN = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireInfraPermission.mockResolvedValue(undefined);
	mocks.isMailConfigured.mockResolvedValue(true);
	mocks.pool.query.mockResolvedValue({ rows: [{ email: 'grace@example.com' }] });
});

describe('sendTestMail', () => {
	it('sends to the admin and audits it', async () => {
		expect(await sendTestMail(ADMIN)).toEqual({ to: 'grace@example.com' });
		expect(mocks.deliverEmail).toHaveBeenCalledWith('grace@example.com', 'system.test', 'Test email', expect.any(String));
		expect(mocks.audit).toHaveBeenCalledWith(ADMIN, 'mail.test', { type: 'system' }, { to: 'grace@example.com' });
	});

	it('answers 409 when mail is not set up', async () => {
		mocks.isMailConfigured.mockResolvedValue(false);

		await expect(sendTestMail(ADMIN)).rejects.toMatchObject({ status: 409 });
	});

	it('answers 502 and hides the transport error', async () => {
		mocks.deliverEmail.mockRejectedValue(new Error('smtp password rejected'));
		const failure = await sendTestMail(ADMIN).catch((e) => e);

		expect(failure.status).toBe(502);
		expect(JSON.stringify(failure.body)).not.toContain('password');
	});

	it('needs settings.manage', async () => {
		mocks.requireInfraPermission.mockRejectedValue(Object.assign(new Error('no'), { status: 403 }));

		await expect(sendTestMail(ADMIN)).rejects.toMatchObject({ status: 403 });
		expect(mocks.deliverEmail).not.toHaveBeenCalled();
	});
});

describe('testStorageConnection', () => {
	it('audits a good probe', async () => {
		await testStorageConnection(ADMIN);

		expect(mocks.audit).toHaveBeenCalledWith(ADMIN, 'storage.test', { type: 'system' });
	});

	it('answers 409 when storage is not set up', async () => {
		mocks.testStorage.mockRejectedValue(new StorageNotConfiguredError());

		await expect(testStorageConnection(ADMIN)).rejects.toMatchObject({ status: 409 });
	});

	it('answers 502 without leaking the S3 error', async () => {
		mocks.testStorage.mockRejectedValue(new Error('AccessDenied for key AKIA123'));
		const failure = await testStorageConnection(ADMIN).catch((e) => e);

		expect(failure.status).toBe(502);
		expect(JSON.stringify(failure.body)).not.toContain('AKIA');
		expect(mocks.audit).not.toHaveBeenCalled();
	});
});
