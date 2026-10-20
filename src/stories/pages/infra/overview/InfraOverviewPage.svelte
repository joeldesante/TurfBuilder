<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import StatTile from '$components/data-display/stat-tile/StatTile.svelte';
	import LineChart from '$components/data-display/charts/LineChart/LineChart.svelte';
	import DonutChart from '$components/data-display/charts/DonutChart/DonutChart.svelte';
	import AuditLogTable from '$components/data-display/audit-log-table/AuditLogTable.svelte';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircle';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircle';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOut';
	import { percentChange } from '$lib/shared/utils/chart-series';
	import { formatDate } from '$lib/shared/utils/format-date';
	import type { PlatformOverview } from '$lib/shared/types/metrics';
	import type { AuditEntry } from '$lib/shared/types/audit';

	interface Props {
		overview: PlatformOverview;
		/** The viewing admin's infrastructure permissions, to link only to pages they can open. */
		permissions: string[];
	}

	let { overview, permissions }: Props = $props();

	const canSettings = $derived(permissions.includes('settings.manage'));

	interface StatusItem {
		ok: boolean;
		label: string;
		href?: string;
	}

	const status = $derived<StatusItem[]>([
		{
			ok: overview.status.mailConfigured,
			label: overview.status.mailConfigured ? 'Mail is set up' : 'Mail is not set up; no emails are sent',
			href: canSettings ? '/infra/settings?tab=email' : undefined
		},
		{
			ok: overview.status.storageConfigured,
			label: overview.status.storageConfigured ? 'Storage is set up' : 'Storage is not set up; photos and PDFs fail',
			href: canSettings ? '/infra/settings?tab=storage' : undefined
		},
		{
			ok: !overview.status.migrationNeeded,
			label: overview.status.migrationNeeded ? 'The database needs a migration' : 'The database is up to date',
			href: canSettings ? '/infra/migrate' : undefined
		},
		{
			ok: overview.status.failedEmails24h === 0,
			label:
				overview.status.failedEmails24h === 0
					? 'No failed emails today'
					: `${overview.status.failedEmails24h} ${overview.status.failedEmails24h === 1 ? 'email' : 'emails'} failed in 24 hours`,
			href: canSettings ? '/infra/settings/email/log?status=failed' : undefined
		},
		{
			ok: overview.status.failedDocuments24h === 0,
			label:
				overview.status.failedDocuments24h === 0
					? 'No failed PDFs today'
					: `${overview.status.failedDocuments24h} ${overview.status.failedDocuments24h === 1 ? 'PDF' : 'PDFs'} failed in 24 hours`,
			href: '/infra/system'
		}
	]);

	const attention = $derived(status.filter((s) => !s.ok));

	function auditHref(type: AuditEntry['targetType'], id: string): string | null {
		if (type === 'user') return `/infra/users/${id}`;
		if (type === 'organization') return `/infra/orgs/${id}`;
		return null;
	}
</script>

<PageHeader title="Overview" subheading="How the platform is doing, and anything that needs you." />

<div class="space-y-6">
	<section aria-labelledby="status-heading" class="rounded-xl border border-outline-subtle p-4">
		<h2 id="status-heading" class="text-sm font-medium text-on-surface">
			{attention.length === 0 ? 'Everything looks healthy' : `${attention.length} ${attention.length === 1 ? 'thing needs' : 'things need'} attention`}
		</h2>
		<ul class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{#each status as item (item.label)}
				<li class="flex items-start gap-2 text-sm">
					{#if item.ok}
						<CheckCircleIcon class="mt-0.5 size-4 shrink-0" style="color: var(--chart-delta-good)" weight="fill" />
						<span class="sr-only">Healthy:</span>
					{:else}
						<WarningCircleIcon class="mt-0.5 size-4 shrink-0 text-error" weight="fill" />
						<span class="sr-only">Needs attention:</span>
					{/if}
					{#if item.href && !item.ok}
						<a href={item.href}>{item.label}</a>
					{:else}
						<span class={item.ok ? 'text-on-surface-subtle' : 'text-on-surface'}>{item.label}</span>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section aria-label="Headline figures" class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
		<StatTile label="Accounts" value={overview.users} format="compact" href="/infra/users" />
		<StatTile
			label="New this week"
			value={overview.newUsers7d.value}
			change={percentChange(overview.newUsers7d.value, overview.newUsers7d.previous)}
			changeLabel="vs the week before"
			href="/infra/users"
		/>
		<StatTile
			label="Active today"
			value={overview.activeUsers.daily}
			hint={`${overview.activeUsers.weekly.toLocaleString()} this week, ${overview.activeUsers.monthly.toLocaleString()} this month`}
			href="/infra/metrics"
		/>
		<StatTile
			label="Organizations"
			value={overview.organizations}
			hint={`${overview.activeOrgs30d.toLocaleString()} active in 30 days`}
			href="/infra/orgs"
		/>
		<StatTile
			label="Visits this week"
			value={overview.visits7d.value}
			format="compact"
			change={percentChange(overview.visits7d.value, overview.visits7d.previous)}
			changeLabel="vs the week before"
			href="/infra/metrics"
		/>
		<StatTile
			label="Emails this week"
			value={overview.emails7d.sent}
			hint={overview.emails7d.failed ? `${overview.emails7d.failed} failed` : 'None failed'}
			href={canSettings ? '/infra/settings/email/log' : undefined}
		/>
	</section>

	<section class="grid gap-4 lg:grid-cols-3" aria-label="Trends">
		<LineChart
			title="Growth"
			subtitle="Last 30 days"
			series={overview.growth}
			granularity="day"
			csvFilename="growth-30d"
			class="lg:col-span-2"
		/>
		<DonutChart title="Organizations by size" data={overview.orgSizes} centerLabel="Organizations" csvFilename="organization-sizes" />
	</section>

	<section class="grid gap-4 lg:grid-cols-2" aria-label="Recent">
		<div class="rounded-xl border border-outline-subtle">
			<h2 class="border-b border-outline-subtle px-4 py-3 text-sm font-medium text-on-surface">Newest accounts</h2>
			<ul class="divide-y divide-outline-subtle">
				{#each overview.recentUsers as user (user.id)}
					<li class="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
						<a href={`/infra/users/${user.id}`} class="min-w-0 truncate">{user.name} <span class="text-on-surface-subtle">{user.email}</span></a>
						<span class="shrink-0 text-xs text-on-surface-subtle">{formatDate(user.createdAt)}</span>
					</li>
				{:else}
					<li class="px-4 py-6 text-center text-sm text-on-surface-subtle">No accounts yet.</li>
				{/each}
			</ul>
		</div>
		<div class="rounded-xl border border-outline-subtle">
			<h2 class="border-b border-outline-subtle px-4 py-3 text-sm font-medium text-on-surface">Newest organizations</h2>
			<ul class="divide-y divide-outline-subtle">
				{#each overview.recentOrgs as org (org.id)}
					<li class="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
						<a href={`/infra/orgs/${org.id}`} class="min-w-0 truncate">{org.name} <span class="text-on-surface-subtle">/{org.slug}</span></a>
						<span class="shrink-0 text-xs text-on-surface-subtle">{formatDate(org.createdAt)}</span>
					</li>
				{:else}
					<li class="px-4 py-6 text-center text-sm text-on-surface-subtle">No organizations yet.</li>
				{/each}
			</ul>
		</div>
	</section>

	{#if overview.recentAudit}
		<section class="rounded-xl border border-outline-subtle" aria-labelledby="audit-heading">
			<div class="flex items-center justify-between border-b border-outline-subtle px-4 py-3">
				<h2 id="audit-heading" class="text-sm font-medium text-on-surface">Recent admin changes</h2>
				<a href="/infra/audit" class="text-sm">Audit log</a>
			</div>
			<AuditLogTable items={overview.recentAudit} targetHref={auditHref} emptyText="No admin has changed anything yet." />
		</section>
	{/if}

	{#if overview.externalLinks.length > 0}
		<section aria-labelledby="tools-heading">
			<h2 id="tools-heading" class="text-sm font-medium text-on-surface">External tools</h2>
			<ul class="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
				{#each overview.externalLinks as link (link.url)}
					<li>
						<a
							href={link.url}
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center justify-between gap-2 rounded-xl border border-outline-subtle px-4 py-3 text-sm no-underline hover:bg-surface-container-low"
						>
							<span class="min-w-0">
								<span class="block font-medium text-on-surface">{link.label}</span>
								<span class="block truncate text-xs text-on-surface-subtle">{link.url}</span>
							</span>
							<ArrowSquareOutIcon class="size-4 shrink-0 text-on-surface-subtle" />
							<span class="sr-only">(opens in a new tab)</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
