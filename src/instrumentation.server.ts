import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { createAddHookMessageChannel } from 'import-in-the-middle';
import { register } from 'node:module';

const { registerOptions } = createAddHookMessageChannel();
register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions);

const sdk = new NodeSDK({
	serviceName: 'turfbuilder',
	traceExporter: new OTLPTraceExporter({
		url: 'http://jaeger:4318/v1/traces',
	}),
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