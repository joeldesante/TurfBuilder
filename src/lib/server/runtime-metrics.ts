import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import v8 from 'node:v8';
import os from 'node:os';
import { readFileSync } from 'node:fs';
import { logger } from '$lib/server/logger';
import { POOL, AUTH_POOL } from '$lib/server/database';

/**
 * Periodic process health line, for tracing CPU and memory spikes in the log
 * aggregator. Holds only process-level numbers, never tenant data.
 *
 * - cpuPercent: CPU time used since the last line, as a share of one core
 * - eventLoop*: how late timers fire; high p99 means the loop is blocked
 * - memory: resident set, V8 heap in use, and the heap limit it is heading for
 * - pools: Postgres connections in use and requests waiting for one
 *
 * - containerMemoryMb: what the container's cgroup counts, which includes Chrome
 *   and everything else in it. This, not rssMb, is what the OOM killer compares
 *   to memoryLimitMb.
 * - memoryLimitMb: the memory the container may use (the k8s limit, or the
 *   Docker --memory value). Absent when nothing limits it.
 *
 * LOG_METRICS_INTERVAL_MS sets the period (default 30000, 0 turns it off).
 */

const DEFAULT_INTERVAL_MS = 30_000;
const MB = 1024 * 1024;
const toMb = (bytes: number) => Math.round((bytes / MB) * 10) / 10;
const toMs = (nanos: number) => Math.round((nanos / 1e6) * 10) / 10;

function readNumber(path: string): number | undefined {
	try {
		const value = Number(readFileSync(path, 'utf8').trim());
		return Number.isFinite(value) ? value : undefined;
	} catch {
		return undefined;
	}
}

/**
 * The memory the container may use, in bytes, or undefined when unlimited.
 * Node reads the cgroup limit; "unlimited" shows up as 0 or as a number larger
 * than the machine, so both count as no limit.
 */
export function memoryLimitBytes(): number | undefined {
	const limit = (process as unknown as { constrainedMemory?: () => number }).constrainedMemory?.();
	return limit && limit > 0 && limit < os.totalmem() ? limit : undefined;
}

/** Memory the container's cgroup currently counts (v2, then v1), in bytes. */
function containerMemoryBytes(): number | undefined {
	return (
		readNumber('/sys/fs/cgroup/memory.current') ??
		readNumber('/sys/fs/cgroup/memory/memory.usage_in_bytes')
	);
}

/** CPU cores the container may use: the cgroup quota when set, else undefined. */
function cpuLimitCores(): number | undefined {
	try {
		// cgroup v2: "<quota> <period>" or "max <period>"
		const [quota, period] = readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim().split(' ');
		if (quota !== 'max' && Number(period) > 0) return Number(quota) / Number(period);
	} catch {
		// cgroup v1 below
	}
	const quota = readNumber('/sys/fs/cgroup/cpu/cpu.cfs_quota_us');
	const period = readNumber('/sys/fs/cgroup/cpu/cpu.cfs_period_us');
	return quota && quota > 0 && period ? quota / period : undefined;
}

const STARTED = Symbol.for('turfbuilder.runtimeMetrics');

export function startRuntimeMetrics(): void {
	const g = globalThis as Record<symbol, unknown>;
	// Dev reloads re-run this module; one timer is enough.
	if (g[STARTED]) return;

	const parsed = Number(process.env.LOG_METRICS_INTERVAL_MS);
	const intervalMs = process.env.LOG_METRICS_INTERVAL_MS && Number.isFinite(parsed) ? parsed : DEFAULT_INTERVAL_MS;
	if (intervalMs <= 0) return;
	g[STARTED] = true;

	const limit = memoryLimitBytes();
	logger.info(
		{
			memoryLimitMb: limit ? toMb(limit) : undefined,
			hostMemoryMb: toMb(os.totalmem()),
			heapLimitMb: toMb(v8.getHeapStatistics().heap_size_limit),
			cpuLimitCores: cpuLimitCores(),
			cpusVisible: os.availableParallelism(),
			nodeVersion: process.version
		},
		'runtime limits'
	);

	const loopDelay = monitorEventLoopDelay({ resolution: 20 });
	loopDelay.enable();
	let lastCpu = process.cpuUsage();
	let lastTime = performance.now();
	let lastLoop = performance.eventLoopUtilization();

	const timer = setInterval(() => {
		const now = performance.now();
		const cpu = process.cpuUsage(lastCpu);
		const elapsedMs = now - lastTime;
		const loop = performance.eventLoopUtilization(lastLoop);
		const mem = process.memoryUsage();
		const heap = v8.getHeapStatistics();
		const containerBytes = containerMemoryBytes();

		logger.info(
			{
				cpuPercent: Math.round(((cpu.user + cpu.system) / 1000 / elapsedMs) * 1000) / 10,
				eventLoopUtilization: Math.round(loop.utilization * 100) / 100,
				eventLoopDelayP50Ms: toMs(loopDelay.percentile(50)),
				eventLoopDelayP99Ms: toMs(loopDelay.percentile(99)),
				eventLoopDelayMaxMs: toMs(loopDelay.max),
				rssMb: toMb(mem.rss),
				heapUsedMb: toMb(mem.heapUsed),
				heapLimitMb: toMb(heap.heap_size_limit),
				containerMemoryMb: containerBytes ? toMb(containerBytes) : undefined,
				memoryLimitMb: limit ? toMb(limit) : undefined,
				memoryUsedPercent:
					limit && containerBytes ? Math.round((containerBytes / limit) * 1000) / 10 : undefined,
				externalMb: toMb(mem.external),
				arrayBuffersMb: toMb(mem.arrayBuffers),
				pool: poolStats(POOL),
				authPool: poolStats(AUTH_POOL),
				uptimeSeconds: Math.round(process.uptime())
			},
			'runtime metrics'
		);

		loopDelay.reset();
		lastCpu = process.cpuUsage();
		lastTime = now;
		lastLoop = performance.eventLoopUtilization();
	}, intervalMs);
	// Never keep the process alive just to report on it.
	timer.unref();

	// Observes crashes without changing how Node handles them.
	process.on('uncaughtExceptionMonitor', (err, origin) => {
		logger.fatal({ err, origin }, 'Process crashing');
	});
}

function poolStats(pool: { totalCount: number; idleCount: number; waitingCount: number }) {
	return { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount };
}
