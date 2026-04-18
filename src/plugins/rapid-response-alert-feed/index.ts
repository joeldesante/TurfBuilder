import type { PluginManifest } from '$plugins/types';
import AlertFeedPage from '$pages/orgs/plugins/rapid-response-alert-feed/AlertFeedPage.svelte';
import StaffAlertFeedPage from '$pages/orgs/plugins/rapid-response-alert-feed/StaffAlertFeedPage.svelte';

export interface Alert {
	id: string;
	title: string;
	body: string;
	category: 'urgent' | 'info' | 'update';
	author: string;
	publishedAt: string;
}

const EXAMPLE_ALERTS: Alert[] = [
	{
		id: '1',
		title: 'Polling location change in Ward 4',
		body: 'The polling location at Lincoln Elementary has moved to the community center on Oak Street due to a facility issue. Please update your turf notes and inform any voters you speak with.',
		category: 'urgent',
		author: 'Maria Gonzalez',
		publishedAt: new Date(Date.now() - 45 * 60_000).toISOString()
	},
	{
		id: '2',
		title: 'Canvassing hours extended tonight',
		body: "Great news — we've received permission to canvass until 8 PM in all precincts tonight. Make the most of the extra time and focus on low-propensity supporters.",
		category: 'update',
		author: 'James Okafor',
		publishedAt: new Date(Date.now() - 3 * 3_600_000).toISOString()
	},
	{
		id: '3',
		title: 'Weekend training session',
		body: 'A refresher training on the new survey questions will be held Saturday at 10 AM at HQ. Attendance is encouraged for all canvassers who joined after March 1st.',
		category: 'info',
		author: 'Sarah Kim',
		publishedAt: new Date(Date.now() - 26 * 3_600_000).toISOString()
	}
];

/**
 * Rapid Response Alert Feed — publishes real-time alerts to canvassers in the field.
 * Staff can post urgent, info, or update alerts that all volunteers for the org see immediately.
 */
const rapidResponseAlertFeedPlugin: PluginManifest = {
	slug: 'rapid-response-alert-feed',
	name: 'Rapid Response Alert Feed',
	description: 'Publish real-time alerts to canvassers in the field.',
	version: '0.1.0',
	navEntries: (orgSlug) => [
		{
			kind: 'item',
			item: { label: 'Alert Feed', href: `/o/${orgSlug}/s/plugins/rapid-response-alert-feed` }
		}
	],
	pages: {
		index: StaffAlertFeedPage
	},
	volunteerPages: {
		index: AlertFeedPage
	},
	serverLoad: async () => ({ alerts: EXAMPLE_ALERTS })
};

export default rapidResponseAlertFeedPlugin;
