import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CONTROL = Symbol.for('turfbuilder.telemetry');
const control = { setTraces: vi.fn(), setLogs: vi.fn() };

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	(globalThis as Record<symbol, unknown>)[CONTROL] = control;
});

afterEach(() => {
	delete (globalThis as Record<symbol, unknown>)[CONTROL];
});

describe('applyTelemetry', () => {
	it('exports nothing when both endpoints are empty', async () => {
		const { applyTelemetry } = await import('./telemetry');
		applyTelemetry({ tracesEndpoint: '', logsEndpoint: '' });

		expect(control.setTraces).toHaveBeenCalledWith(null);
		expect(control.setLogs).toHaveBeenCalledWith(null);
	});

	it('points traces and logs at the configured endpoints', async () => {
		const { applyTelemetry } = await import('./telemetry');
		applyTelemetry({
			tracesEndpoint: 'http://jaeger:4318/v1/traces',
			logsEndpoint: 'https://us.i.posthog.com/i/v1/logs'
		});

		expect(control.setTraces).toHaveBeenCalledWith('http://jaeger:4318/v1/traces');
		expect(control.setLogs).toHaveBeenCalledWith('https://us.i.posthog.com/i/v1/logs');
	});

	it('only reconfigures when the settings change', async () => {
		const { applyTelemetry } = await import('./telemetry');
		applyTelemetry({ tracesEndpoint: 'http://jaeger:4318/v1/traces', logsEndpoint: '' });
		applyTelemetry({ tracesEndpoint: 'http://jaeger:4318/v1/traces', logsEndpoint: '' });

		expect(control.setTraces).toHaveBeenCalledOnce();
	});

	it('does nothing when the instrumentation did not start', async () => {
		delete (globalThis as Record<symbol, unknown>)[CONTROL];
		const { applyTelemetry } = await import('./telemetry');

		expect(() => applyTelemetry({ tracesEndpoint: '', logsEndpoint: '' })).not.toThrow();
		expect(control.setTraces).not.toHaveBeenCalled();
	});
});
