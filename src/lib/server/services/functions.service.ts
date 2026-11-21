import { env } from '$env/dynamic/private';
import { logger } from '$lib/server/logger';

/**
 * The serverless functions the app can call, and the arguments each takes.
 * Callers use these names, never a platform's package or URL, so the platform
 * can change without touching them.
 */
export interface FunctionArgs {
	'import-contacts': { orgId: string; jobId: string };
}

export type FunctionName = keyof FunctionArgs;

export interface InvokeOptions {
	/** Wait for the function to finish. The default is to start it and return. */
	wait: boolean;
}

export interface FunctionInvocation {
	/** The platform's id for this run, safe to log. */
	activationId: string;
	/** What the function returned. Only set when the call waited. */
	result?: unknown;
}

/**
 * A place serverless functions run. A new platform implements this, is created
 * in `createProvider` (index.ts), and gets a `FUNCTIONS_PROVIDER` value.
 */
export interface FunctionProvider {
	invoke(name: FunctionName, args: unknown, options: InvokeOptions): Promise<FunctionInvocation>;
}

export class FunctionsNotConfiguredError extends Error {
	constructor() {
		super('Serverless functions are not configured. Set FUNCTIONS_API_URL and FUNCTIONS_API_KEY.');
		this.name = 'FunctionsNotConfiguredError';
	}
}

/** The message is safe to log. It never holds arguments or anything the function returned. */
export class FunctionInvokeError extends Error {
	constructor(
		message: string,
		readonly status?: number
	) {
		super(message);
		this.name = 'FunctionInvokeError';
	}
}

/** The DigitalOcean package each function is deployed in (functions/project.yml). */
const PACKAGES: Record<FunctionName, string> = {
	'import-contacts': 'imports'
};

const START_TIMEOUT_MS = 10_000;
const WAIT_TIMEOUT_MS = 60_000;

export interface DigitalOceanConfig {
	/** Base URL of the invoke API: the namespace's host, or the local dev server. */
	apiUrl: string;
	namespace: string;
	/** The namespace key, `user:secret`. */
	apiKey: string;
	fetch?: typeof fetch;
}

/**
 * Calls DigitalOcean Functions through its invoke API. The local dev server in
 * `functions/dev-server.js` has the same API, so it works with this provider too.
 */
export function createDigitalOceanProvider(config: DigitalOceanConfig): FunctionProvider {
	const base = config.apiUrl.replace(/\/+$/, '');
	const authorization = `Basic ${Buffer.from(config.apiKey).toString('base64')}`;

	return {
		async invoke(name, args, { wait }): Promise<FunctionInvocation> {
			const url = `${base}/api/v1/namespaces/${encodeURIComponent(config.namespace)}/actions/${PACKAGES[name]}/${name}?blocking=${wait}`;

			let res: Response;
			try {
				res = await (config.fetch ?? fetch)(url, {
					method: 'POST',
					headers: { authorization, 'content-type': 'application/json' },
					body: JSON.stringify(args),
					signal: AbortSignal.timeout(wait ? WAIT_TIMEOUT_MS : START_TIMEOUT_MS)
				});
			} catch {
				throw new FunctionInvokeError('The function platform could not be reached');
			}

			// A blocking call that outlasts the platform's wait also answers 202, with only the id.
			if (res.status !== 200 && res.status !== 202) {
				throw new FunctionInvokeError('The function platform refused the call', res.status);
			}

			const body = (await res.json().catch(() => null)) as {
				activationId?: unknown;
				response?: { success?: boolean; result?: unknown };
			} | null;
			if (typeof body?.activationId !== 'string') {
				throw new FunctionInvokeError(
					'The function platform sent an unexpected answer',
					res.status
				);
			}

			if (wait && body.response) {
				if (!body.response.success) {
					throw new FunctionInvokeError('The function failed', res.status);
				}
				return { activationId: body.activationId, result: body.response.result };
			}
			return { activationId: body.activationId };
		}
	};
}

/**
 * Serverless functions, behind one interface so the platform is a setting and not
 * a dependency. Services call `invokeFunction`; nothing else knows which platform
 * runs the code. Credentials come from the environment, never the database.
 *
 *   FUNCTIONS_PROVIDER   `digitalocean` (default). Also covers the local dev server.
 *   FUNCTIONS_API_URL    Base URL of the invoke API, e.g. http://localhost:3233
 *   FUNCTIONS_NAMESPACE  DigitalOcean namespace id. Defaults to `_`.
 *   FUNCTIONS_API_KEY    The namespace key, or FUNCTIONS_LOCAL_KEY in dev.
 *
 * Callers pass ids only. Arguments are never logged.
 */

let cached: { key: string; provider: FunctionProvider } | undefined;

function createProvider(): FunctionProvider {
	const kind = env.FUNCTIONS_PROVIDER || 'digitalocean';
	const apiUrl = env.FUNCTIONS_API_URL;
	const apiKey = env.FUNCTIONS_API_KEY;
	if (!apiUrl || !apiKey) throw new FunctionsNotConfiguredError();
	const namespace = env.FUNCTIONS_NAMESPACE || '_';

	const key = [kind, apiUrl, namespace, apiKey].join('|');
	if (cached?.key === key) return cached.provider;

	if (kind !== 'digitalocean') throw new FunctionsNotConfiguredError();
	const provider = createDigitalOceanProvider({ apiUrl, namespace, apiKey });
	cached = { key, provider };
	return provider;
}

/**
 * Runs a function. By default it starts the run and returns; pass `wait: true` to
 * wait for the result. Throws `FunctionsNotConfiguredError` or `FunctionInvokeError`.
 */
export async function invokeFunction<N extends FunctionName>(
	name: N,
	args: FunctionArgs[N],
	options: { wait?: boolean } = {}
): Promise<FunctionInvocation> {
	const provider = createProvider();
	const started = Date.now();
	try {
		const invocation = await provider.invoke(name, args, { wait: options.wait ?? false });
		logger.info(
			{ function: name, activationId: invocation.activationId, durationMs: Date.now() - started },
			'Serverless function invoked'
		);
		return invocation;
	} catch (err) {
		logger.error({ err, function: name }, 'Serverless function could not be invoked');
		throw err;
	}
}
