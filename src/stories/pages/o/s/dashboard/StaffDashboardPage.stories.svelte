<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StaffDashboardPage from './StaffDashboardPage.svelte';
	import type { DashboardPoint } from '$lib/server/dashboard';

	const buckets = [
		{ id: 'b1', slug: 'germantown-ave', name: 'Germantown Ave businesses' },
		{ id: 'b2', slug: 'chelten-corridor', name: 'Chelten corridor' }
	];

	const STATUSES = ['contacted', 'no-contact', 'unvisited'] as const;
	const mapPoints: DashboardPoint[] = Array.from({ length: 60 }, (_, i) => {
		const status = STATUSES[i % 3];
		return {
			id: `loc-${i}`,
			name: `Location ${i + 1}`,
			address: `${5500 + i * 10} Germantown Ave, Philadelphia`,
			longitude: -75.175 + (i % 10) * 0.0015,
			latitude: 40.035 + Math.floor(i / 10) * 0.0012,
			status,
			visits: status === 'unvisited' ? 0 : 1 + (i % 4),
			lastVisitAt: status === 'unvisited' ? null : new Date(Date.now() - i * 86_400_000).toISOString()
		};
	});

	const { Story } = defineMeta({
		title: 'Pages/O/S/Dashboard',
		component: StaffDashboardPage,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen'
		}
	});
</script>

<Story
	name="Default"
	args={{
		orgSlug: 'north-west-philly-alliance',
		buckets,
		mapPoints,
		progress: { total: 60, visited: 40, conversations: 20, visits: 100, answeredVisits: 38, recentConversations: 12 }
	}}
/>
