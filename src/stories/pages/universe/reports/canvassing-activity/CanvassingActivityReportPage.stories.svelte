<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CanvassingActivityReportPage from './CanvassingActivityReportPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/Reports/Canvassing Activity',
		component: CanvassingActivityReportPage,
		tags: ['autodocs']
	});
</script>

<Story
	name="Empty"
	args={{ orgSlug: 'demo-org', activity: [], totalResponses: 0 }}
/>

<Story
	name="With Data"
	args={{
		orgSlug: 'demo-org',
		totalResponses: 142,
		activity: [
			{ date: '2026-06-25', response_count: 38 },
			{ date: '2026-06-24', response_count: 51 },
			{ date: '2026-06-23', response_count: 29 },
			{ date: '2026-06-22', response_count: 24 }
		]
	}}
/>
