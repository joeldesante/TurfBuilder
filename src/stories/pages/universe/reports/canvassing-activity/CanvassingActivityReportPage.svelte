<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';

	interface DailyActivity {
		date: string;
		response_count: number;
	}

	interface Props {
		orgSlug: string;
		activity?: DailyActivity[];
		totalResponses?: number;
	}

	const { orgSlug, activity = [], totalResponses = 0 }: Props = $props();
</script>

<div>
	<PageHeader
		title="Canvassing Activity"
		breadcrumbs={[
			{ label: 'Reports', href: `/o/${orgSlug}/s/universe/reports` },
			{ label: 'Canvassing Activity' }
		]}
		subheading="Survey responses submitted over time, broken down by date and turf."
	/>

	<div class="rounded-xl border border-outline bg-surface-container p-6">
		<p class="text-sm text-on-surface-subtle">
			Total responses: <span class="font-medium text-on-surface">{totalResponses.toLocaleString()}</span>
		</p>

		{#if activity.length === 0}
			<p class="mt-6 text-sm text-on-surface-subtle">No canvassing activity recorded yet.</p>
		{:else}
			<div class="mt-6 space-y-2">
				{#each activity as day}
					<div class="flex items-center justify-between text-sm">
						<span class="text-on-surface-subtle">{day.date}</span>
						<span class="font-medium text-on-surface">{day.response_count.toLocaleString()}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
