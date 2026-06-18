<script lang="ts">
	import { untrack } from 'svelte';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Switch from '$components/data-inputs/switch/Switch.svelte';
	import Tooltip from '$components/feedback/tooltip/Tooltip.svelte';

	export interface Integration {
		id: string;
		name: string;
		description: string;
		/** Absolute URL or data URI for the integration logo. */
		logoUrl: string;
		enabled: boolean;
		/** When true the tile cannot be toggled. */
		disabled?: boolean;
		/** Tooltip text shown on hover when the tile is disabled. */
		disabledMessage?: string;
		/** When true the toggle switch is hidden and the integration cannot be disabled. */
		permanent?: boolean;
	}

	interface Props {
		integrations: Integration[];
		orgSlug: string;
		onToggle: (id: string, enabled: boolean) => Promise<void>;
	}

	const { integrations, orgSlug, onToggle }: Props = $props();

	let toggling = $state<Record<string, boolean>>({});
	let localEnabled = $state<Record<string, boolean>>(
		untrack(() => Object.fromEntries(integrations.map((i) => [i.id, i.enabled])))
	);

	async function handleToggle(id: string, checked: boolean) {
		toggling[id] = true;
		localEnabled[id] = checked;
		try {
			await onToggle(id, checked);
		} catch {
			localEnabled[id] = !checked;
		} finally {
			toggling[id] = false;
		}
	}
</script>

<PageHeader
	title="Integrations"
	subheading="Connect your organization's universe to external data sources and services."
/>

{#if integrations.length === 0}
	<p class="px-6 py-12 text-sm text-on-surface-subtle text-center">No integrations available.</p>
{:else}
	<div class="px-6 pb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each integrations as integration (integration.id)}
			{@const enabled = localEnabled[integration.id] ?? integration.enabled}
			{@const busy = toggling[integration.id] ?? false}
			{@const isDisabled = integration.disabled ?? false}

			{#snippet tile()}
				{@const navigable = !isDisabled && (integration.permanent || enabled)}
				<!-- tabindex="0" makes the div a valid Tooltip trigger target when disabled -->
				<div
					class="relative flex flex-col rounded-xl border p-5 gap-4 transition-shadow h-full {isDisabled
						? 'border-outline-subtle bg-surface-container/50 opacity-60 cursor-not-allowed'
						: 'border-outline bg-surface-container hover:shadow-sm'}"
					tabindex={isDisabled ? 0 : undefined}
				>
					{#if navigable}
						<a
							href="/o/{orgSlug}/s/universe/data/integrations/{integration.id}"
							class="absolute inset-0 rounded-xl z-0"
							aria-label="Open {integration.name} dashboard"
						></a>
					{/if}

					<div class="relative z-10 flex items-start justify-between gap-3">
						<div class="size-12 shrink-0 rounded-lg border border-outline-subtle bg-surface flex items-center justify-center overflow-hidden">
							<img src={integration.logoUrl} alt="{integration.name} logo" class="size-8 object-contain" />
						</div>
						{#if !integration.permanent && !isDisabled}
							<Switch
								checked={enabled}
								disabled={busy}
								onCheckedChange={(checked) => handleToggle(integration.id, checked)}
								aria-label="Enable {integration.name}"
							/>
						{/if}
					</div>

					<div class="relative z-10 flex flex-col gap-1">
						<div class="flex items-center gap-2">
							<p class="text-sm font-medium text-on-surface">{integration.name}</p>
							{#if enabled && !isDisabled}
								<span class="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
									Active
								</span>
							{/if}
						</div>
						<p class="text-xs text-on-surface-subtle leading-relaxed">{integration.description}</p>
					</div>
				</div>
			{/snippet}

			{#if isDisabled && integration.disabledMessage}
				<Tooltip text={integration.disabledMessage} side="top" delayDuration={100} triggerClass="block w-full h-full text-left">
					{@render tile()}
				</Tooltip>
			{:else}
				{@render tile()}
			{/if}
		{/each}
	</div>
{/if}
