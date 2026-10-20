import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' } as Record<string, string>,
	pool: { query: vi.fn() },
	requireInfraPermission: vi.fn(),
	audit: vi.fn(),
	resetAuth: vi.fn(),
	storageCredentialsPresent: vi.fn(() => ({ accessKeyId: true, secretAccessKey: false }))
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/database', () => ({ POOL: mocks.pool }));
vi.mock('$lib/server/permissions', () => ({ requireInfraPermission: mocks.requireInfraPermission }));
vi.mock('$lib/server/storage', () => ({ storageCredentialsPresent: mocks.storageCredentialsPresent }));
vi.mock('$lib/auth', () => ({ resetAuth: mocks.resetAuth }));
vi.mock('./audit.service', () => ({ audit: mocks.audit }));

import { getCredentialStatus, getExternalLinks, getSystemSettings, updateSystemSettings } from './system-settings.service';
import { SYSTEM_SETTINGS } from '$lib/shared/registries/system-settings';

const ADMIN = '11111111-1111-4111-8111-111111111111';

/** Makes the table hold exactly these rows. */
function stored(rows: Record<string, string>) {
	mocks.pool.query.mockImplementation(async (sql: string, params: unknown[]) => {
		if (sql.startsWith('SELECT')) {
			const keys = params[0] as string[];
			return {
				rows: keys.filter((k) => k in rows).map((key) => ({ key, value: rows[key], updated_at: new Date('2026-10-01T00:00:00Z') }))
			};
		}
		return { rows: [], rowCount: 1 };
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireInfraPermission.mockResolvedValue(undefined);
	stored({});
});

describe('getSystemSettings', () => {
	it('returns every registered setting, falling back to its default', async () => {
		stored({ application_name: 'Acme' });

		const settings = await getSystemSettings(ADMIN);

		expect(settings).toHaveLength(SYSTEM_SETTINGS.length);
		expect(settings.find((s) => s.key === 'application_name')).toMatchObject({ value: 'Acme', updatedAt: '2026-10-01T00:00:00.000Z' });
		expect(settings.find((s) => s.key === 'links.custom')).toMatchObject({ value: '[]', updatedAt: null });
	});

	it('needs settings.manage', async () => {
		mocks.requireInfraPermission.mockRejectedValue(Object.assign(new Error('no'), { status: 403 }));

		await expect(getSystemSettings(ADMIN)).rejects.toMatchObject({ status: 403 });
		expect(mocks.pool.query).not.toHaveBeenCalled();
	});
});

describe('updateSystemSettings', () => {
	it('saves only what changed and records before and after', async () => {
		stored({ application_name: 'Old', 'mail.domain': 'mail.example.com' });

		const result = await updateSystemSettings(ADMIN, { application_name: 'New', 'mail.domain': 'mail.example.com' });

		expect(result).toEqual({ saved: ['application_name'], restartRequired: false });
		const write = mocks.pool.query.mock.calls.find((c) => String(c[0]).startsWith('INSERT'))!;
		expect(write[1][0]).toEqual(['application_name']);
		expect(write[1][1]).toEqual(['New']);
		expect(mocks.audit).toHaveBeenCalledWith(ADMIN, 'settings.update', { type: 'setting' }, { changes: [{ key: 'application_name', from: 'Old', to: 'New' }] });
	});

	it('writes nothing when nothing changed', async () => {
		stored({ application_name: 'Same' });

		expect(await updateSystemSettings(ADMIN, { application_name: 'Same' })).toEqual({ saved: [], restartRequired: false });
		expect(mocks.pool.query.mock.calls.some((c) => String(c[0]).startsWith('INSERT'))).toBe(false);
		expect(mocks.audit).not.toHaveBeenCalled();
	});

	it('keeps raw header HTML out of the audit log', async () => {
		await updateSystemSettings(ADMIN, { 'html.header_content': '<script>secret()</script>' });

		expect(JSON.stringify(mocks.audit.mock.calls[0])).not.toContain('secret');
	});

	it('rebuilds auth and asks for a restart when the base URL changes', async () => {
		stored({ base_url: 'http://localhost:5173' });

		const result = await updateSystemSettings(ADMIN, { base_url: 'https://app.example.com' });

		expect(mocks.resetAuth).toHaveBeenCalled();
		expect(result.restartRequired).toBe(true);
	});

	it('answers 400 for an unregistered key and writes nothing', async () => {
		await expect(updateSystemSettings(ADMIN, { nope: 'x' })).rejects.toMatchObject({ status: 400 });
		expect(mocks.pool.query).not.toHaveBeenCalled();
	});

	it('needs settings.manage', async () => {
		mocks.requireInfraPermission.mockRejectedValue(Object.assign(new Error('no'), { status: 403 }));

		await expect(updateSystemSettings(ADMIN, { application_name: 'x' })).rejects.toMatchObject({ status: 403 });
	});
});

describe('getExternalLinks', () => {
	it('lists analytics, tracing, then custom links, skipping empty ones', async () => {
		stored({
			'links.analytics_url': 'https://analytics.example.com',
			'links.tracing_url': '',
			'links.custom': JSON.stringify([{ label: 'Grafana', url: 'https://grafana.example.com' }])
		});

		expect(await getExternalLinks()).toEqual([
			{ label: 'Analytics', url: 'https://analytics.example.com' },
			{ label: 'Grafana', url: 'https://grafana.example.com' }
		]);
	});

	it('treats a malformed custom list as no links', async () => {
		stored({ 'links.analytics_url': '', 'links.custom': '{not json' });

		expect(await getExternalLinks()).toEqual([]);
	});
});

describe('getCredentialStatus', () => {
	it('reports presence only', async () => {
		mocks.env.AWS_ACCESS_KEY_ID = 'AKIA';
		mocks.env.AWS_SECRET_ACCESS_KEY = 'secret';

		const status = await getCredentialStatus(ADMIN);

		expect(status).toEqual({ aws: true, storageAccessKey: true, storageSecretKey: false });
		expect(JSON.stringify(status)).not.toContain('AKIA');
	});

	it('is false for SES when either key is missing', async () => {
		delete mocks.env.AWS_ACCESS_KEY_ID;
		mocks.env.AWS_SECRET_ACCESS_KEY = 'secret';

		expect((await getCredentialStatus(ADMIN)).aws).toBe(false);
	});
});
