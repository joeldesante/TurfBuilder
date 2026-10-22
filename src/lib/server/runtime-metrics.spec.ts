import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { info } = vi.hoisted(() => ({ info: vi.fn() }));

vi.mock('$lib/server/logger', () => ({ logger: { info, fatal: vi.fn() } }));
vi.mock('$lib/server/database', () => ({
	POOL: { totalCount: 4, idleCount: 1, waitingCount: 2 },
	AUTH_POOL: { totalCount: 1, idleCount: 1, waitingCount: 0 }
}));

const STARTED = Symbol.for('turfbuilder.runtimeMetrics');

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	delete (globalThis as Record<symbol, unknown>)[STARTED];
	delete process.env.LOG_METRICS_INTERVAL_MS;
});

afterEach(() => {
	vi.useRealTimers();
});

describe('startRuntimeMetrics', () => {
	it('logs process and pool numbers on an interval, with no tenant data', async () => {
		const { startRuntimeMetrics } = await import('./runtime-metrics');
		startRuntimeMetrics();

		await vi.advanceTimersByTimeAsync(30_000);

		const lines = info.mock.calls.filter(([, message]) => message === 'runtime metrics');
		expect(lines).toHaveLength(1);
		const [fields, message] = lines[0];
		expect(message).toBe('runtime metrics');
		expect(fields).toMatchObject({
			pool: { total: 4, idle: 1, waiting: 2 },
			authPool: { total: 1, idle: 1, waiting: 0 }
		});
		expect(Object.keys(fields)).toEqual(
			expect.arrayContaining(['cpuPercent', 'rssMb', 'heapUsedMb', 'eventLoopDelayP99Ms'])
		);
	});

	it('starts only once', async () => {
		const { startRuntimeMetrics } = await import('./runtime-metrics');
		startRuntimeMetrics();
		startRuntimeMetrics();

		await vi.advanceTimersByTimeAsync(30_000);

		expect(info.mock.calls.filter(([, m]) => m === 'runtime metrics')).toHaveLength(1);
		expect(info.mock.calls.filter(([, m]) => m === 'runtime limits')).toHaveLength(1);
	});

	it('logs the limits once at startup', async () => {
		const { startRuntimeMetrics } = await import('./runtime-metrics');
		startRuntimeMetrics();

		const limits = info.mock.calls.find(([, m]) => m === 'runtime limits');
		expect(Object.keys(limits![0])).toEqual(
			expect.arrayContaining(['hostMemoryMb', 'heapLimitMb', 'cpusVisible', 'nodeVersion'])
		);
	});

	it('is off when the interval is 0', async () => {
		process.env.LOG_METRICS_INTERVAL_MS = '0';
		const { startRuntimeMetrics } = await import('./runtime-metrics');
		startRuntimeMetrics();

		await vi.advanceTimersByTimeAsync(120_000);

		expect(info).not.toHaveBeenCalled();
	});
});
