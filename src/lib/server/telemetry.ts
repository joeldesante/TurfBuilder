import { logger } from '$lib/server/logger';
import type { ObservabilitySettings } from '$lib/server/settings';

/**
 * Points the OpenTelemetry exporters at the endpoints in the infra dashboard.
 * The SDK itself starts in src/instrumentation.server.ts, before settings can
 * be read, and exposes this control on globalThis. Called on every request;
 * it only reconfigures when the settings changed.
 *
 * Auth headers are not settings: the exporters read them from
 * OTEL_EXPORTER_OTLP_TRACES_HEADERS and OTEL_EXPORTER_OTLP_LOGS_HEADERS, so
 * credentials stay out of the database.
 */

interface TelemetryControl {
	setTraces(url: string | null): void;
	setLogs(url: string | null): void;
}

const CONTROL = Symbol.for('turfbuilder.telemetry');

let appliedKey: string | null = null;

export function applyTelemetry(settings: ObservabilitySettings['telemetry']): void {
	const control = (globalThis as Record<symbol, unknown>)[CONTROL] as TelemetryControl | undefined;
	// Absent when the instrumentation did not run, such as in tests.
	if (!control) return;

	const traces = settings.tracesEndpoint || null;
	const logs = settings.logsEndpoint || null;
	const key = JSON.stringify([traces, logs]);
	if (key === appliedKey) return;
	appliedKey = key;

	try {
		control.setTraces(traces);
		control.setLogs(logs);
		// Whether each export is on, not where: endpoints stay out of logs.
		logger.info({ traces: Boolean(traces), logs: Boolean(logs) }, 'Telemetry export configured');
	} catch (err) {
		logger.error({ err }, 'Telemetry export could not be configured; it keeps its previous setup');
	}
}
