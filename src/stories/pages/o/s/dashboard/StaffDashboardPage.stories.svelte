<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StaffDashboardPage from './StaffDashboardPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Dashboard',
		component: StaffDashboardPage,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen'
		}
	});

	// Cumulative canvass attempts over the last ~3 months (2026-04-01 to 2026-06-29).
	// Only active days are listed; the page fills in zeros for gaps.
	const mockTimeSeries = [
		{ date: '2026-04-01', count: 9 },
		{ date: '2026-04-02', count: 14 },
		{ date: '2026-04-03', count: 11 },
		{ date: '2026-04-07', count: 18 },
		{ date: '2026-04-08', count: 22 },
		{ date: '2026-04-09', count: 16 },
		{ date: '2026-04-10', count: 20 },
		{ date: '2026-04-14', count: 25 },
		{ date: '2026-04-15', count: 30 },
		{ date: '2026-04-16', count: 19 },
		{ date: '2026-04-17', count: 27 },
		{ date: '2026-04-21', count: 33 },
		{ date: '2026-04-22', count: 28 },
		{ date: '2026-04-23', count: 35 },
		{ date: '2026-04-24', count: 24 },
		{ date: '2026-04-28', count: 38 },
		{ date: '2026-04-29', count: 41 },
		{ date: '2026-04-30', count: 36 },
		{ date: '2026-05-01', count: 29 },
		{ date: '2026-05-05', count: 44 },
		{ date: '2026-05-06', count: 47 },
		{ date: '2026-05-07', count: 39 },
		{ date: '2026-05-08', count: 52 },
		{ date: '2026-05-12', count: 55 },
		{ date: '2026-05-13', count: 48 },
		{ date: '2026-05-14', count: 61 },
		{ date: '2026-05-15', count: 43 },
		{ date: '2026-05-19', count: 66 },
		{ date: '2026-05-20', count: 70 },
		{ date: '2026-05-21', count: 58 },
		{ date: '2026-05-22', count: 73 },
		{ date: '2026-05-27', count: 78 },
		{ date: '2026-05-28', count: 64 },
		{ date: '2026-05-29', count: 81 },
		{ date: '2026-06-02', count: 75 },
		{ date: '2026-06-03', count: 83 },
		{ date: '2026-06-04', count: 69 },
		{ date: '2026-06-05', count: 88 },
		{ date: '2026-06-09', count: 92 },
		{ date: '2026-06-10', count: 77 },
		{ date: '2026-06-11', count: 97 },
		{ date: '2026-06-12', count: 84 },
		{ date: '2026-06-16', count: 103 },
		{ date: '2026-06-17', count: 89 },
		{ date: '2026-06-18', count: 110 },
		{ date: '2026-06-19', count: 95 },
		{ date: '2026-06-23', count: 116 },
		{ date: '2026-06-24', count: 101 },
		{ date: '2026-06-25', count: 122 },
		{ date: '2026-06-26', count: 108 },
		{ date: '2026-06-29', count: 130 }
	];
</script>

<Story
	name="Default"
	args={{
		orgSlug: 'north-west-philly-alliance',
		applicationName: 'TurfBuilder',
		mockTimeSeries,
		initialRange: '3m'
	}}
/>
