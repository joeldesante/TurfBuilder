<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Switch from '$components/data-inputs/switch/Switch.svelte';
	import Badge from '$components/data-display/badge/Badge.svelte';

	interface Plugin {
		slug: string;
		name: string;
		description: string;
		version: string;
		installed: boolean;
		enabled: boolean;
	}

	interface Props {
		plugins: Plugin[];
		onToggle: (slug: string, enabled: boolean) => Promise<void>;
	}

	const { plugins, onToggle }: Props = $props();

	let togglingSlug = $state<string | null>(null);
	let optimisticEnabled = $state<Map<string, boolean>>(new Map());

	function isEnabled(plugin: Plugin): boolean {
		if (optimisticEnabled.has(plugin.slug)) return optimisticEnabled.get(plugin.slug)!;
		return plugin.installed && plugin.enabled;
	}

	async function handleToggle(slug: string, enabled: boolean) {
		togglingSlug = slug;
		optimisticEnabled.set(slug, enabled);
		try {
			await onToggle(slug, enabled);
		} catch {
			optimisticEnabled.delete(slug);
		} finally {
			togglingSlug = null;
		}
	}
</script>

<PageHeader title="Plugins" subheading="Extend your organization with additional features." />

<div class="p-6 max-w-3xl space-y-3">
	{#each plugins as plugin}
		<div class="rounded-lg border border-outline p-4 flex items-start justify-between gap-4">
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2 mb-1">
					<span class="font-medium text-on-surface">{plugin.name}</span>
					<Badge>{plugin.version}</Badge>
					{#if isEnabled(plugin)}
						<Badge variant="success">Active</Badge>
					{/if}
				</div>
				<p class="text-sm text-on-surface-subtle">{plugin.description}</p>
			</div>
			<Switch
				checked={isEnabled(plugin)}
				disabled={togglingSlug === plugin.slug}
				aria-label="Enable {plugin.name}"
				onCheckedChange={(checked) => handleToggle(plugin.slug, checked)}
			/>
		</div>
	{:else}
		<p class="text-on-surface-subtle text-sm py-8 text-center">No plugins are available.</p>
	{/each}
</div>
