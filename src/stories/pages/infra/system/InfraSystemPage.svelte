<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircle';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircle';
	import { formatBytes } from '$lib/shared/utils/format-bytes';
	import { formatDuration } from '$lib/shared/utils/chart-format';
	import type { SystemHealth } from '$lib/shared/types/system-health';

	interface Props {
		health: SystemHealth;
		/** The viewing admin's infrastructure permissions, to link only to pages they can open. */
		permissions: string[];
	}

	let { health, permissions }: Props = $props();

	const canSettings = $derived(permissions.includes('settings.manage'));
	const { status, runtime, database } = $derived(health);

	const checks = $derived([
		{
			ok: !status.migrationNeeded,
			label: status.migrationNeeded ? 'The database needs a migration' : 'The database is up to date',
			href: canSettings ? '/infra/migrate' : undefined
		},
		{
			ok: status.mailConfigured,
			label: status.mailConfigured ? 'Mail is set up' : 'Mail is not set up',
			href: canSettings ? '/infra/settings?tab=email' : undefined
		},
		{
			ok: status.storageConfigured,
			label: status.storageConfigured ? 'Storage is set up' : 'Storage is not set up',
			href: canSettings ? '/infra/settings?tab=storage' : undefined
		},
		{
			ok: status.chromiumPathSet,
			label: status.chromiumPathSet ? 'PDF generation uses the installed Chromium' : 'PDF generation uses the browser Puppeteer downloaded'
		},
		{
			ok: status.emails24h.failed === 0,
			label: status.emails24h.failed === 0 ? 'No failed emails in 24 hours' : `${status.emails24h.failed} failed emails in 24 hours`,
			href: canSettings && status.emails24h.failed > 0 ? '/infra/settings/email/log?status=failed' : undefined
		},
		{
			ok: status.failedDocuments24h === 0,
			label: status.failedDocuments24h === 0 ? 'No failed PDFs in 24 hours' : `${status.failedDocuments24h} failed PDFs in 24 hours`
		}
	]);
</script>

<PageHeader title="System health" subheading="Whether this instance and what it depends on are working." />

<div class="space-y-8">
	<section aria-labelledby="status-heading">
		<h2 id="status-heading" class="text-lg font-medium text-on-surface">Status</h2>
		<ul class="mt-3 grid gap-2 sm:grid-cols-2">
			{#each checks as check (check.label)}
				<li class="flex items-start gap-2 text-sm">
					{#if check.ok}
						<CheckCircleIcon class="mt-0.5 size-4 shrink-0" style="color: var(--chart-delta-good)" weight="fill" />
						<span class="sr-only">Healthy:</span>
					{:else}
						<WarningCircleIcon class="mt-0.5 size-4 shrink-0 text-error" weight="fill" />
						<span class="sr-only">Needs attention:</span>
					{/if}
					{#if check.href && !check.ok}
						<a href={check.href}>{check.label}</a>
					{:else}
						<span class={check.ok ? 'text-on-surface-subtle' : 'text-on-surface'}>{check.label}</span>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section aria-labelledby="runtime-heading">
		<h2 id="runtime-heading" class="text-lg font-medium text-on-surface">Runtime</h2>
		<dl class="mt-3 grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
			<div><dt class="text-sm text-on-surface-subtle">Node</dt><dd class="text-on-surface">{runtime.nodeVersion}</dd></div>
			<div><dt class="text-sm text-on-surface-subtle">Up for</dt><dd class="text-on-surface">{formatDuration(runtime.uptimeSeconds)}</dd></div>
			<div><dt class="text-sm text-on-surface-subtle">Build</dt><dd class="font-mono text-on-surface">{runtime.gitSha ?? 'Not recorded'}</dd></div>
		</dl>
	</section>

	<section aria-labelledby="database-heading">
		<h2 id="database-heading" class="text-lg font-medium text-on-surface">Database</h2>
		<dl class="mt-3 grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
			<div><dt class="text-sm text-on-surface-subtle">PostgreSQL</dt><dd class="text-on-surface">{database.postgresVersion}</dd></div>
			<div><dt class="text-sm text-on-surface-subtle">PostGIS</dt><dd class="text-on-surface">{database.postgisVersion ?? 'Not installed'}</dd></div>
			<div><dt class="text-sm text-on-surface-subtle">Size</dt><dd class="text-on-surface">{formatBytes(database.sizeBytes)}</dd></div>
			<div>
				<dt class="text-sm text-on-surface-subtle">Connections</dt>
				<dd class="text-on-surface tabular-nums">
					{database.pool.total} open, {database.pool.idle} idle, {database.pool.waiting} waiting
				</dd>
			</div>
		</dl>

		<h3 class="mt-6 text-sm font-medium text-on-surface">Largest tables</h3>
		<div class="mt-2 overflow-x-auto rounded-xl border border-outline-subtle">
			<table class="w-full text-sm">
				<thead class="text-left text-on-surface-subtle">
					<tr class="border-b border-outline-subtle">
						<th scope="col" class="px-4 py-2 font-medium">Table</th>
						<th scope="col" class="px-4 py-2 text-right font-medium">Size</th>
						<th scope="col" class="px-4 py-2 text-right font-medium">Rows (estimate)</th>
					</tr>
				</thead>
				<tbody>
					{#each database.largestTables as table (table.name)}
						<tr class="border-b border-outline-subtle last:border-0">
							<td class="px-4 py-2 font-mono text-xs">{table.name}</td>
							<td class="px-4 py-2 text-right tabular-nums">{formatBytes(table.sizeBytes)}</td>
							<td class="px-4 py-2 text-right tabular-nums">{table.estimatedRows.toLocaleString()}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
