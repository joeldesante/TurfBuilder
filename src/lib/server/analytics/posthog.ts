import { PostHog } from 'posthog-node';
import { logger } from '$lib/server/logger';
import type { AnalyticsProvider } from './types';

/**
 * PostHog behind the analytics interface. Loaded with a dynamic import only
 * when an admin turns PostHog on, so other installs never load posthog-node.
 *
 * Batching stays at the library defaults so a request never waits on PostHog.
 * Exception autocapture is off: uncaught errors would be sent unscrubbed, and
 * the app reports errors itself through captureException.
 */
export function createPostHogProvider(host: string, token: string): AnalyticsProvider {
	const client = new PostHog(token, {
		host,
		enableExceptionAutocapture: false,
		// Every event comes from this server's address, so a location is meaningless.
		disableGeoip: true
	});
	client.on('error', (err: unknown) => logger.warn({ err }, 'PostHog could not deliver events'));

	return {
		capture: (distinctId, event, properties) => client.capture({ distinctId, event, properties }),
		captureException: (error, distinctId, properties) =>
			client.captureException(error, distinctId, properties),
		shutdown: () => client.shutdown()
	};
}
