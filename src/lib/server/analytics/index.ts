import { logger, scrubMessage } from '$lib/server/logger';
import type { ObservabilitySettings } from '$lib/server/settings';
import type { AnalyticsProvider } from './types';

/**
 * Product analytics, behind one interface so an install can use PostHog or
 * nothing. The provider comes from the analytics settings in the infra
 * dashboard; configureAnalytics() is called on every request and only acts
 * when those settings change, so a change applies without a restart.
 *
 * Privacy: callers send ids and counts only, never names, emails, addresses,
 * or anything a tenant typed. Exceptions are scrubbed here before they leave.
 */

const NOOP: AnalyticsProvider = {
	capture: () => {},
	captureException: () => {},
	shutdown: async () => {}
};

let current: AnalyticsProvider = NOOP;
let currentKey = 'none';

type AnalyticsSettings = ObservabilitySettings['analytics'];

function keyOf(settings: AnalyticsSettings): string {
	if (settings.provider === 'posthog' && settings.posthogHost && settings.posthogToken) {
		return `posthog|${settings.posthogHost}|${settings.posthogToken}`;
	}
	return 'none';
}

/** Switches provider when the settings changed. Never throws. */
export async function configureAnalytics(settings: AnalyticsSettings): Promise<void> {
	const key = keyOf(settings);
	if (key === currentKey) return;

	// Claimed before any await, so concurrent requests start one provider, not several.
	currentKey = key;
	const previous = current;
	current = NOOP;
	previous.shutdown().catch((err) => logger.warn({ err }, 'Previous analytics provider did not shut down cleanly'));

	if (key === 'none') {
		logger.info({ provider: 'none' }, 'Product analytics off');
		return;
	}

	try {
		const { createPostHogProvider } = await import('./posthog');
		// The settings may have changed again while the module loaded.
		if (currentKey !== key) return;
		current = createPostHogProvider(settings.posthogHost, settings.posthogToken);
		logger.info({ provider: 'posthog' }, 'Product analytics on');
	} catch (err) {
		// The key stays claimed, so a broken setup is reported once, not on every request.
		logger.error({ err, provider: 'posthog' }, 'Product analytics could not start; it stays off');
	}
}

/** An error stripped of anything that could quote tenant data. */
function scrubbedError(error: unknown): Error {
	const source = error instanceof Error ? error : new Error('Non-error thrown');
	const scrubbed = new Error(scrubMessage(source.message));
	scrubbed.name = source.name;
	scrubbed.stack = source.stack ? scrubMessage(source.stack) : undefined;
	return scrubbed;
}

export const analytics = {
	/** Records an event. Fire and forget: never awaited, never throws. */
	capture(distinctId: string, event: string, properties?: Record<string, unknown>): void {
		try {
			current.capture(distinctId, event, properties);
		} catch (err) {
			logger.warn({ err, event }, 'Analytics event dropped');
		}
	},

	/** Reports an error with its message and stack scrubbed. Never throws. */
	captureException(error: unknown, distinctId?: string, properties?: Record<string, unknown>): void {
		try {
			current.captureException(scrubbedError(error), distinctId, properties);
		} catch (err) {
			logger.warn({ err }, 'Analytics exception dropped');
		}
	}
};

/** Flushes and stops the provider, for process shutdown. */
export async function shutdownAnalytics(): Promise<void> {
	const provider = current;
	current = NOOP;
	currentKey = 'none';
	await provider.shutdown();
}
