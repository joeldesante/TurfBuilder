import { NodeSDK, tracing, logs, api } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { createAddHookMessageChannel } from 'import-in-the-middle';
import { register } from 'node:module';

const { registerOptions } = createAddHookMessageChannel();
register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions);

/**
 * Telemetry is optional and configured in the infra dashboard (the Telemetry
 * settings), but the SDK has to start before the app can read those
 * settings. So it starts with processors that export nowhere, and the app
 * points them at the configured endpoints through TELEMETRY_CONTROL (see
 * $lib/server/telemetry), again whenever the settings change.
 *
 * Auth headers come from OTEL_EXPORTER_OTLP_TRACES_HEADERS and
 * OTEL_EXPORTER_OTLP_LOGS_HEADERS, which the exporters read themselves, so
 * credentials stay out of the database.
 */

export interface TelemetryControl {
	setTraces(url: string | null): void;
	setLogs(url: string | null): void;
}

class SwitchableSpanProcessor implements tracing.SpanProcessor {
	private inner: tracing.SpanProcessor | null = null;

	set(url: string | null) {
		const previous = this.inner;
		this.inner = url ? new tracing.BatchSpanProcessor(new OTLPTraceExporter({ url })) : null;
		void previous?.shutdown().catch(() => {});
	}

	onStart(span: tracing.Span, context: api.Context) {
		this.inner?.onStart(span, context);
	}

	onEnd(span: tracing.ReadableSpan) {
		this.inner?.onEnd(span);
	}

	forceFlush() {
		return this.inner?.forceFlush() ?? Promise.resolve();
	}

	shutdown() {
		return this.inner?.shutdown() ?? Promise.resolve();
	}
}

class SwitchableLogProcessor implements logs.LogRecordProcessor {
	private inner: logs.LogRecordProcessor | null = null;

	set(url: string | null) {
		const previous = this.inner;
		this.inner = url ? new logs.BatchLogRecordProcessor(new OTLPLogExporter({ url })) : null;
		void previous?.shutdown().catch(() => {});
	}

	onEmit(record: logs.SdkLogRecord, context?: api.Context) {
		this.inner?.onEmit(record, context);
	}

	forceFlush() {
		return this.inner?.forceFlush() ?? Promise.resolve();
	}

	shutdown() {
		return this.inner?.shutdown() ?? Promise.resolve();
	}
}

const spans = new SwitchableSpanProcessor();
const logRecords = new SwitchableLogProcessor();

const control: TelemetryControl = {
	setTraces: (url) => spans.set(url),
	setLogs: (url) => logRecords.set(url)
};
// A global, not a module export: this file and the app are bundled separately.
(globalThis as Record<symbol, unknown>)[Symbol.for('turfbuilder.telemetry')] = control;

const sdk = new NodeSDK({
	serviceName: 'turfbuilder',
	spanProcessors: [spans],
	// Pino lines reach these through the pino instrumentation's log sending.
	logRecordProcessors: [logRecords],
	instrumentations: [getNodeAutoInstrumentations({
		'@opentelemetry/instrumentation-http': {
			requestHook: (span, request) => {
				if ('method' in request && 'url' in request) {
					const url = new URL(request.url!, `http://${request.headers?.host ?? 'localhost'}`);
					span.updateName(`${request.method} ${url.pathname}`);
				}
			}
		}
	})]
});

sdk.start();
