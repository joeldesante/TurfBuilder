import type { PostHog } from 'posthog-js';
import type { ClientAnalyticsConfig } from '$lib/shared/types/analytics';
import { scrubMessage } from '$lib/shared/utils/scrub';

/**
 * Browser analytics, behind the same on/off choice as the server (the
 * Analytics settings in the infra dashboard). posthog-js is imported only when
 * PostHog is on, so other installs never download it.
 *
 * Privacy: tenants' data must not leave the app, so PostHog is started with
 * everything that reads the page turned off (autocapture of clicked text,
 * session recording, automatic pageviews, exception autocapture), and every
 * event passes through sanitizeEvent, which swaps URLs for the route pattern
 * and drops referrers and page titles. Users are identified by id only.
 */

type Properties = Record<string, unknown>;
interface CapturedEvent {
	properties: Properties;
	$set?: Properties;
	$set_once?: Properties;
}

let client: PostHog | null = null;
let startedKey: string | null = null;
let identifiedId: string | null = null;
let currentRoute = '(unmatched)';

// $current_url, $initial_current_url, $session_entry_url, $pathname, ...
const URL_KEY = /(url|pathname)$/i;
// $referrer, $referring_domain, $initial_referrer, title, ...
const DROP_KEY = /(referrer|referring_domain|title)$/i;

function sanitizeProperties(properties: Properties | undefined, route: string, origin: string) {
	if (!properties) return;
	for (const key of Object.keys(properties)) {
		if (DROP_KEY.test(key)) delete properties[key];
		else if (URL_KEY.test(key)) {
			properties[key] = key.toLowerCase().endsWith('pathname') ? route : `${origin}${route}`;
		}
	}
}

/**
 * Replaces every URL and path on an event with the route pattern, such as
 * /o/[org_slug]/s/turfs/[id], and removes referrers and titles. Paths carry
 * org slugs, invite tokens, and turf codes; titles can carry names.
 */
export function sanitizeEvent<T extends CapturedEvent>(event: T, route: string, origin: string): T {
	sanitizeProperties(event.properties, route, origin);
	sanitizeProperties(event.$set, route, origin);
	sanitizeProperties(event.$set_once, route, origin);
	return event;
}

function keyOf(config: ClientAnalyticsConfig | null) {
	return config ? `${config.provider}|${config.host}|${config.token}` : null;
}

/** Starts or stops analytics to match the settings. Safe to call on every navigation. */
export async function startAnalytics(config: ClientAnalyticsConfig | null): Promise<void> {
	const key = keyOf(config);
	if (key === startedKey) return;
	startedKey = key;

	if (!config) {
		client?.opt_out_capturing();
		client = null;
		identifiedId = null;
		return;
	}

	const { default: posthog } = await import('posthog-js');
	if (startedKey !== key) return;
	posthog.init(config.token, {
		api_host: config.host,
		autocapture: false,
		capture_pageview: false,
		capture_pageleave: false,
		capture_exceptions: false,
		disable_session_recording: true,
		mask_all_text: true,
		mask_all_element_attributes: true,
		person_profiles: 'identified_only',
		before_send: (event) => (event ? sanitizeEvent(event, currentRoute, location.origin) : event)
	});
	posthog.opt_in_capturing();
	client = posthog;
}

/** Ties events to a user id, or forgets the user on sign-out. Never sends a name or email. */
export function identify(userId: string | null): void {
	if (!client || userId === identifiedId) return;
	if (userId) client.identify(userId);
	else client.reset();
	identifiedId = userId;
}

/** Records a pageview under the route pattern, never the URL. */
export function trackPageview(routeId: string | null): void {
	currentRoute = routeId ?? '(unmatched)';
	client?.capture('$pageview');
}

/** Reports a browser error with its message and stack scrubbed. */
export function captureException(error: unknown, properties?: Properties): void {
	if (!client) return;
	const source = error instanceof Error ? error : new Error('Non-error thrown');
	const scrubbed = new Error(scrubMessage(source.message));
	scrubbed.name = source.name;
	scrubbed.stack = source.stack ? scrubMessage(source.stack) : undefined;
	client.captureException(scrubbed, properties);
}
