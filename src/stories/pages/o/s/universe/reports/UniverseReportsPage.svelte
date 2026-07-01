<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import ChartBarIcon from 'phosphor-svelte/lib/ChartBar';
	import ClipboardTextIcon from 'phosphor-svelte/lib/ClipboardText';
	import UsersIcon from 'phosphor-svelte/lib/Users';
	import MapTrifoldIcon from 'phosphor-svelte/lib/MapTrifold';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRight';

	interface ReportCard {
		slug: string;
		title: string;
		description: string;
		icon: typeof ChartBarIcon;
	}

	interface Props {
		orgSlug: string;
	}

	const { orgSlug }: Props = $props();

	const base = $derived(`/o/${orgSlug}/s/universe/reports`);

	const reports: ReportCard[] = [
		{
			slug: 'canvassing-activity',
			title: 'Canvassing Activity',
			description: 'Survey responses submitted over time, broken down by date and turf.',
			icon: ChartBarIcon
		},
		{
			slug: 'survey-results',
			title: 'Survey Results',
			description: 'Answer breakdowns for each survey question across all submissions.',
			icon: ClipboardTextIcon
		},
		{
			slug: 'volunteer-activity',
			title: 'Volunteer Activity',
			description: 'Responses and doors knocked per volunteer for any date range.',
			icon: UsersIcon
		},
		{
			slug: 'turf-coverage',
			title: 'Turf Coverage',
			description: 'Percentage of locations contacted within each assigned turf.',
			icon: MapTrifoldIcon
		}
	];
</script>

<div>
	<PageHeader
		title="Reports"
		subheading="Quick reports for your organization's canvassing data."
	/>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
		{#each reports as report}
			{@const Icon = report.icon}
			<a
				href="{base}/{report.slug}"
				class="group flex flex-col gap-4 rounded-xl border border-outline bg-surface-container p-6 no-underline transition-colors duration-150 hover:border-primary/40 hover:bg-surface-container-high"
			>
				<div class="flex items-start justify-between gap-4">
					<div class="flex items-center gap-3">
						<div class="flex items-center justify-center rounded-lg bg-primary/10 p-2.5">
							<Icon class="size-5 text-primary" />
						</div>
						<h2 class="text-base font-medium text-on-surface">{report.title}</h2>
					</div>
					<ArrowRightIcon class="size-4 shrink-0 text-on-surface-subtle transition-transform duration-150 group-hover:translate-x-0.5" />
				</div>
				<p class="text-sm text-on-surface-subtle">{report.description}</p>
			</a>
		{/each}
	</div>
</div>
