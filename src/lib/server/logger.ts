import pino from 'pino';
import { scrubMessage } from '$lib/shared/utils/scrub';

export { scrubMessage };

/**
 * Shared JSON logger. Every line carries `env` (APP_ENV: development, staging,
 * or production) so logs from different deployments can be told apart.
 *
 * Logs are shipped to an aggregator and must never contain tenant data. The
 * rules, enforced here and by callers:
 *  - Log opaque ids (organizationId, documentId), counts, sizes and durations.
 *    Never log names, emails, addresses, subjects, URLs with values, or bodies.
 *  - Errors go under `err`; the serializer below strips database `detail`
 *    (which quotes row values) and masks quoted values and emails in messages.
 *  - Validation failures go through `zodIssues`, which keeps paths and codes
 *    and drops the received values.
 *  - `redact` is a last line of defense for keys that should never appear.
 *
 * Independent of OpenTelemetry. When tracing is running, the pino
 * instrumentation adds trace_id and span_id to each line; when it is not,
 * the logger works the same without them.
 */

// Fields of a Postgres error that describe where it happened, never the data.
const SAFE_DB_FIELDS = ['code', 'severity', 'schema', 'table', 'column', 'constraint', 'routine'];

/**
 * Serializes an error without the parts that can carry tenant data: the
 * message is scrubbed, `detail`, `where`, `hint`, query text and parameters
 * are dropped, and only the safe Postgres fields are kept.
 */
export function serializeError(err: unknown): Record<string, unknown> {
	if (!(err instanceof Error)) return { type: typeof err, message: '[non-error thrown]' };
	const out: Record<string, unknown> = {
		type: err.name,
		message: scrubMessage(err.message),
		stack: err.stack ? scrubMessage(err.stack.split('\n').slice(1).join('\n')) : undefined
	};
	for (const field of SAFE_DB_FIELDS) {
		const value = (err as unknown as Record<string, unknown>)[field];
		if (typeof value === 'string') out[field] = value;
	}
	const status = (err as { status?: unknown }).status;
	if (typeof status === 'number') out.status = status;
	return out;
}

/** Validation issues as paths and codes only; messages and inputs can quote user data. */
export function zodIssues(error: { issues: { path: PropertyKey[]; code: string }[] }) {
	return error.issues.map((i) => ({ path: i.path.map(String).join('.'), code: i.code }));
}

// Keys that identify a person or carry secrets, in case a caller logs them by mistake.
const REDACTED_KEYS = [
	'email',
	'to',
	'subject',
	'name',
	'phone',
	'address',
	'password',
	'token',
	'secret',
	'authorization',
	'cookie',
	'body',
	'query',
	'params'
];

/**
 * Which instance wrote the line. POD_NAME and NODE_NAME come from the k8s
 * downward API (see .k8s/*.yaml). Inside a cluster without them, HOSTNAME is
 * the pod name. Outside k8s nothing is added: a developer's HOSTNAME is their
 * machine's name.
 */
const inCluster = Boolean(process.env.KUBERNETES_SERVICE_HOST);
const instance = {
	pod: process.env.POD_NAME || (inCluster ? process.env.HOSTNAME : undefined),
	node: process.env.NODE_NAME || undefined
};

export const logger = pino({
	// Tests run silent unless LOG_LEVEL asks otherwise.
	level: process.env.LOG_LEVEL || (process.env.VITEST ? 'silent' : 'info'),
	base: { service: 'turfbuilder', env: process.env.APP_ENV || 'development', ...instance },
	timestamp: pino.stdTimeFunctions.isoTime,
	serializers: { err: serializeError },
	redact: {
		paths: [...REDACTED_KEYS, ...REDACTED_KEYS.map((k) => `*.${k}`)],
		censor: '[redacted]'
	},
	formatters: {
		level: (label) => ({ level: label })
	}
});
