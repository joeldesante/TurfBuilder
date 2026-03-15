<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StaffAlertFeedPage from './StaffAlertFeedPage.svelte';
	import type { Alert } from './AlertFeedPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Orgs/Plugins/RapidResponseAlertFeed/StaffAlertFeedPage',
		component: StaffAlertFeedPage,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle: 'Staff-facing alert management page for the Rapid Response Alert Feed plugin.'
			}
		}
	});

	const sampleAlerts: Alert[] = [
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
			body: 'Great news — we've received permission to canvass until 8 PM in all precincts tonight. Make the most of the extra time and focus on low-propensity supporters.',
			category: 'update',
			author: 'James Okafor',
			publishedAt: new Date(Date.now() - 3 * 3600_000).toISOString()
		},
		{
			id: '3',
			title: 'Weekend training session',
			body: 'A refresher training on the new survey questions will be held Saturday at 10 AM at HQ. Attendance is encouraged for all canvassers who joined after March 1st.',
			category: 'info',
			author: 'Sarah Kim',
			publishedAt: new Date(Date.now() - 26 * 3600_000).toISOString()
		}
	];

	function noop() {
		return Promise.resolve();
	}
</script>

<Story name="With Alerts" args={{ alerts: sampleAlerts, onPublish: noop, onDelete: noop }} />

<Story name="Empty" args={{ alerts: [], onPublish: noop, onDelete: noop }} />

<Story name="Single Alert" args={{ alerts: [sampleAlerts[0]], onPublish: noop, onDelete: noop }} />
