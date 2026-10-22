import { describe, it, expect, vi, beforeEach } from 'vitest';

const posthog = vi.hoisted(() => ({
	capture: vi.fn(),
	captureException: vi.fn(),
	shutdown: vi.fn(async () => {}),
	on: vi.fn(),
	constructed: vi.fn()
}));

vi.mock('posthog-node', () => ({
	PostHog: vi.fn(function (this: unknown, token: string, options: unknown) {
		posthog.constructed(token, options);
		return posthog;
	})
}));

import { analytics, configureAnalytics, shutdownAnalytics } from './index';

const OFF = { provider: 'none' as const, posthogHost: '', posthogToken: '' };
const ON = { provider: 'posthog' as const, posthogHost: 'https://us.i.posthog.com', posthogToken: 'phc_abc' };

beforeEach(async () => {
	await shutdownAnalytics();
	vi.clearAllMocks();
});

describe('analytics', () => {
	it('sends nothing and loads nothing while off', async () => {
		await configureAnalytics(OFF);
		analytics.capture('u1', 'survey_deleted', { survey_id: 's1' });

		expect(posthog.constructed).not.toHaveBeenCalled();
	});

	it('sends events to PostHog once it is turned on', async () => {
		await configureAnalytics(ON);
		analytics.capture('u1', 'survey_deleted', { survey_id: 's1' });

		expect(posthog.constructed).toHaveBeenCalledWith(
			'phc_abc',
			expect.objectContaining({ host: 'https://us.i.posthog.com', enableExceptionAutocapture: false })
		);
		expect(posthog.capture).toHaveBeenCalledWith({
			distinctId: 'u1',
			event: 'survey_deleted',
			properties: { survey_id: 's1' }
		});
	});

	it('starts one client however often the same settings are applied', async () => {
		await Promise.all([configureAnalytics(ON), configureAnalytics(ON)]);
		await configureAnalytics(ON);

		expect(posthog.constructed).toHaveBeenCalledOnce();
	});

	it('flushes and stops PostHog when it is turned off', async () => {
		await configureAnalytics(ON);
		await configureAnalytics(OFF);
		analytics.capture('u1', 'survey_deleted');

		expect(posthog.shutdown).toHaveBeenCalled();
		expect(posthog.capture).not.toHaveBeenCalled();
	});

	it('treats PostHog without a host or token as off', async () => {
		await configureAnalytics({ ...ON, posthogToken: '' });

		expect(posthog.constructed).not.toHaveBeenCalled();
	});

	it('scrubs exceptions before they leave', async () => {
		await configureAnalytics(ON);
		analytics.captureException(new Error('Invalid recipient jane@example.org for "Riverside"'), 'u1');

		const [sent] = posthog.captureException.mock.calls[0];
		expect(sent.message).toBe('Invalid recipient [email] for "?"');
	});

	it('never throws when the provider does', async () => {
		await configureAnalytics(ON);
		posthog.capture.mockImplementation(() => {
			throw new Error('queue full');
		});

		expect(() => analytics.capture('u1', 'survey_deleted')).not.toThrow();
	});
});
