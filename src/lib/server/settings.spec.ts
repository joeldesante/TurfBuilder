import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('$lib/server/database', () => ({ POOL: { query: mocks.query } }));

import { getAllSettings, NotReadyError } from './settings';

beforeEach(() => vi.clearAllMocks());

async function failure(): Promise<NotReadyError> {
	return getAllSettings().then(
		() => {
			throw new Error('expected getAllSettings to fail');
		},
		(e) => e
	);
}

describe('getAllSettings when the app is not ready', () => {
	it('reports a missing table as not migrated', async () => {
		mocks.query.mockRejectedValue(Object.assign(new Error('relation "system_setting" does not exist'), { code: '42P01' }));

		const e = await failure();
		expect(e).toBeInstanceOf(NotReadyError);
		expect(e.code).toBe('APP_NOT_MIGRATED');
	});

	it('reports any other database failure as unreachable, keeping the cause', async () => {
		const cause = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
		mocks.query.mockRejectedValue(cause);

		const e = await failure();
		expect(e.code).toBe('DATABASE_UNREACHABLE');
		expect(e.cause).toBe(cause);
	});

	it.each([[[]], [[{ key: 'base_url', value: 'https://turf.test' }]]])('reports missing required settings as not set up', async (rows) => {
		mocks.query.mockResolvedValue({ rows });

		expect((await failure()).code).toBe('APP_NOT_SET_UP');
	});
});
