<script lang="ts">
	import Badge from '$components/data-display/badge/Badge.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import type { ContactImportJob, ContactImportJobStatus } from '$lib/shared/types/contact-imports';
	import { formatDateTime } from '$lib/shared/utils/format-date';

	interface Props {
		orgSlug: string;
		/** The organization's import jobs, as loaded with the page. */
		jobs?: ContactImportJob[];
		/**
		 * Reads the jobs again. While any job is waiting or running the page calls it every
		 * `pollMs` and shows what comes back. A failure keeps what is on screen and tries again.
		 * Without it the page shows the jobs it was given and does not update.
		 */
		onRefresh?: () => Promise<ContactImportJob[]>;
		/** Milliseconds between reads while a job is active. @default 2000 */
		pollMs?: number;
	}

	const { orgSlug, jobs = [], onRefresh, pollMs = 2000 }: Props = $props();

	/** The newest read, until the page is given jobs again. */
	let latest = $state<ContactImportJob[] | null>(null);
	const shown = $derived(latest ?? jobs);

	$effect(() => {
		void jobs;
		latest = null;
	});

	const isActive = (job: ContactImportJob) => job.status === 'queued' || job.status === 'running';
	const active = $derived(shown.filter(isActive));
	const finished = $derived(shown.filter((job) => !isActive(job)));

	$effect(() => {
		if (!onRefresh || active.length === 0) return;
		let reading = false;
		const timer = setInterval(async () => {
			// A slow read is not stacked on by the next tick.
			if (reading) return;
			reading = true;
			try {
				latest = await onRefresh();
			} catch {
				// Keep what is on screen; the next tick tries again.
			} finally {
				reading = false;
			}
		}, pollMs);
		return () => clearInterval(timer);
	});

	const STATUS: Record<
		ContactImportJobStatus,
		{ label: string; variant: 'default' | 'info' | 'success' | 'error' }
	> = {
		queued: { label: 'Waiting', variant: 'default' },
		running: { label: 'Running', variant: 'default' },
		completed: { label: 'Done', variant: 'success' },
		failed: { label: 'Failed', variant: 'error' }
	};

	/** Whole percent of rows written. Null when the file's rows were never counted. */
	function percent(job: ContactImportJob): number | null {
		if (job.status === 'completed') return 100;
		if (job.rows_total === null) return null;
		if (job.rows_total === 0) return 0;
		return Math.min(99, Math.floor((job.rows_processed / job.rows_total) * 100));
	}

	const count = (n: number) => n.toLocaleString('en-US');

	/** "25% · 250 of 1,000 rows · started Nov 15, 2026, 6:01 PM", without the parts that are not known. */
	function summary(job: ContactImportJob): string {
		const pct = percent(job);
		const rows =
			job.rows_total === null
				? `${count(job.rows_processed)} rows`
				: `${count(job.rows_processed)} of ${count(job.rows_total)} rows`;
		const when =
			job.status === 'completed' && job.finished_at
				? `finished ${formatDateTime(job.finished_at)}`
				: job.started_at
					? `started ${formatDateTime(job.started_at)}`
					: `added ${formatDateTime(job.created_at)}`;
		const skipped = job.rows_skipped > 0 ? `${count(job.rows_skipped)} skipped` : null;
		return [pct === null ? null : `${pct}%`, rows, skipped, when].filter(Boolean).join(' \u00b7 ');
	}
</script>

{#snippet jobRow(job: ContactImportJob)}
	{@const pct = percent(job)}
	<li
		class="rounded-lg border border-outline bg-surface-container-low p-4"
		data-testid="import-job"
	>
		<div class="flex flex-wrap items-center justify-between gap-2">
			<p class="min-w-0 truncate text-base text-on-surface">{job.file_name}</p>
			<Badge variant={STATUS[job.status].variant} size="sm">{STATUS[job.status].label}</Badge>
		</div>

		<div
			role="progressbar"
			aria-label="Progress of {job.file_name}"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={pct ?? undefined}
			class="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-container"
		>
			<div
				data-testid="import-bar-fill"
				data-state={job.status === 'failed'
					? 'failed'
					: job.status === 'completed'
						? 'completed'
						: 'partial'}
				class="h-full rounded-full transition-[width] duration-500 {job.status === 'failed'
					? 'bg-error'
					: job.status === 'completed'
						? 'bg-primary'
						: 'bar-running'}"
				style="width: {job.status === 'failed' || job.status === 'completed' ? 100 : (pct ?? 0)}%"
			></div>
		</div>

		<p class="mt-2 text-sm text-on-surface-subtle">{summary(job)}</p>

		{#if job.status === 'failed' && job.error}
			<p class="mt-2 text-sm text-error">{job.error}</p>
		{/if}
	</li>
{/snippet}

<div class="flex h-full flex-col">
	<div class="flex shrink-0 items-center gap-2 pt-2 lg:pt-4 pb-2 lg:pb-6">
		<Button
			href="/o/{orgSlug}/s/universe/data/contacts/import"
			variant="ghost"
			iconOnly
			aria-label="Back to Import Contacts"
			class="shrink-0 text-on-surface-subtle hover:text-on-surface"
		>
			<ArrowLeftIcon />
		</Button>
		<PageHeader title="Active Imports" class="!py-0 min-w-0 flex-1" />
	</div>

	<div class="min-h-0 w-full flex-1 space-y-8 overflow-y-auto">
		{#if shown.length === 0}
			<p class="py-12 text-center text-base text-on-surface-subtle" data-testid="no-imports">
				No imports have been started yet.
			</p>
		{:else}
			{#if active.length > 0}
				<section aria-labelledby="active-imports-heading" class="space-y-3">
					<h2 id="active-imports-heading" class="text-lg text-on-surface">In progress</h2>
					<ul class="space-y-3">
						{#each active as job (job.id)}
							{@render jobRow(job)}
						{/each}
					</ul>
				</section>
			{/if}
			{#if finished.length > 0}
				<section aria-labelledby="finished-imports-heading" class="space-y-3">
					<h2 id="finished-imports-heading" class="text-lg text-on-surface">Finished</h2>
					<ul class="space-y-3">
						{#each finished as job (job.id)}
							{@render jobRow(job)}
						{/each}
					</ul>
				</section>
			{/if}
		{/if}
	</div>
</div>

<style>
	/* The same sweep as the loading label on the map (LocationsMap): a gradient that is wider than
	   the bar, drifting across it, so the fill looks like it is moving while it waits on the rows. */
	.bar-running {
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--primary) 55%, transparent),
			var(--primary),
			color-mix(in srgb, var(--primary) 70%, transparent),
			var(--primary),
			color-mix(in srgb, var(--primary) 45%, transparent),
			var(--primary),
			color-mix(in srgb, var(--primary) 55%, transparent)
		);
		background-size: 300%;
		animation: shimmer-sweep 8s linear infinite;
	}

	/* Reversed from the map's label, which drifts the other way: a bar fills left to right, so the
	   wave runs with it. */
	@keyframes shimmer-sweep {
		from {
			background-position: 300%;
		}
		to {
			background-position: 0%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bar-running {
			animation: none;
			background: var(--primary);
		}
	}
</style>
