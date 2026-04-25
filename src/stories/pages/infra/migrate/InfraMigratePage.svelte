<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';

	type StepStatus = 'pending' | 'running' | 'done' | 'error';

	interface SchemaProgress {
		step: number;
		total: number;
		label: string;
		status: StepStatus;
		error?: string;
	}

	let started = $state(false);
	let complete = $state(false);
	let errorMessage = $state('');
	let progressItems = $state<SchemaProgress[]>([]);

	let progressPercent = $derived(
		progressItems.length === 0
			? 0
			: Math.round(
					(progressItems.filter((p) => p.status === 'done').length /
						(progressItems[0]?.total ?? 1)) *
						100
				)
	);

	async function runMigration() {
		started = true;
		complete = false;
		errorMessage = '';
		progressItems = [];

		const res = await fetch('/infra/migrate/api', { method: 'POST' });
		if (!res.body) {
			errorMessage = 'No response body';
			return;
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				if (!line.startsWith('data: ')) continue;
				const data = JSON.parse(line.slice(6));

				if (data.done) {
					complete = true;
					continue;
				}

				const existing = progressItems.findIndex((p) => p.step === data.step);
				if (existing >= 0) {
					progressItems[existing] = data as SchemaProgress;
				} else {
					progressItems = [...progressItems, data as SchemaProgress];
				}

				if (data.status === 'error') {
					errorMessage = data.error ?? 'Unknown error';
					return;
				}
			}
		}
	}

	function reset() {
		started = false;
		complete = false;
		errorMessage = '';
		progressItems = [];
	}
</script>

<PageHeader
	title="Database Migration"
	subheading="Re-run schema setup to apply new tables, indexes, and policies. Safe to run on an existing database — no data will be modified."
/>

<div class="p-6 max-w-2xl space-y-4">
	{#if !started}
		<div class="rounded-lg border border-outline bg-surface-container-low px-5 py-6 space-y-4">
			<p class="text-sm text-on-surface-subtle">
				This runs all schema setup steps idempotently. Existing tables, data, and settings are
				preserved. Only new additions (tables, columns, indexes, seed rows) will be applied.
			</p>
			<button
				onclick={runMigration}
				class="rounded-md bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:opacity-90 transition-opacity"
			>
				Run Migration
			</button>
		</div>
	{:else}
		<div class="rounded-lg border border-outline bg-surface-container-low px-5 py-5 space-y-4">
			<div class="w-full bg-surface-container rounded-full h-2">
				<div
					class="h-2 rounded-full transition-all duration-300
						{errorMessage ? 'bg-error' : complete ? 'bg-success' : 'bg-primary'}"
					style="width: {complete ? 100 : progressPercent}%"
				></div>
			</div>

			<div class="space-y-2 max-h-72 overflow-y-auto">
				{#each progressItems as item (item.step)}
					<div class="flex items-center gap-3 text-sm">
						<span class="w-5 text-center shrink-0">
							{#if item.status === 'done'}
								<span class="text-success">✓</span>
							{:else if item.status === 'running'}
								<span class="text-primary animate-spin inline-block">⟳</span>
							{:else if item.status === 'error'}
								<span class="text-error">✗</span>
							{/if}
						</span>
						<span class="{item.status === 'error' ? 'text-error' : 'text-on-surface'}"
							>{item.label}</span
						>
					</div>
				{/each}
			</div>

			{#if complete}
				<div class="flex items-center gap-2 text-on-success-container bg-success-container border border-success rounded-lg px-4 py-3 text-sm">
					<span>✓</span>
					<span>Migration complete.</span>
				</div>
				<button
					onclick={reset}
					class="rounded-md border border-outline px-4 py-1.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
				>
					Run Again
				</button>
			{/if}

			{#if errorMessage}
				<div class="bg-error-container border border-error rounded-lg px-4 py-3 text-sm text-on-error-container">
					<p class="font-medium">Migration failed</p>
					<p class="font-mono text-xs mt-1 break-all">{errorMessage}</p>
				</div>
				<button
					onclick={reset}
					class="rounded-md border border-outline px-4 py-1.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
				>
					Try Again
				</button>
			{/if}
		</div>
	{/if}
</div>
