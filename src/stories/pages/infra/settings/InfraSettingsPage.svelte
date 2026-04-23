<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Switch from '$components/data-inputs/switch/Switch.svelte';

	interface Setting {
		key: string;
		value: string;
		description: string | null;
	}

	interface Props {
		settings: Setting[];
		onToggle: (key: string, value: boolean) => Promise<void>;
	}

	const { settings, onToggle }: Props = $props();

	let saving = $state<string | null>(null);
	let error = $state<string | null>(null);

	function isBooleanSetting(value: string) {
		return value === 'true' || value === 'false';
	}

	function labelForKey(key: string): string {
		const labels: Record<string, string> = {
			'organizations.allow_creation': 'Allow Organization Creation'
		};
		return labels[key] ?? key;
	}

	async function handleToggle(key: string, checked: boolean) {
		saving = key;
		error = null;
		try {
			await onToggle(key, checked);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save setting.';
		} finally {
			saving = null;
		}
	}
</script>

<PageHeader
	title="System Settings"
	subheading="Configure system-wide behavior for this installation."
/>

<div class="p-6 space-y-4 max-w-2xl">
	{#if error}
		<div class="rounded-lg border border-error bg-error/10 px-4 py-3 text-sm text-error">
			{error}
		</div>
	{/if}

	<div class="rounded-lg border border-outline divide-y divide-outline overflow-hidden">
		{#each settings as setting}
			<div class="flex items-start justify-between gap-4 px-5 py-4 bg-surface-container-low">
				<div class="space-y-0.5 min-w-0">
					<p class="text-sm font-medium text-on-surface">{labelForKey(setting.key)}</p>
					{#if setting.description}
						<p class="text-xs text-on-surface-subtle">{setting.description}</p>
					{/if}
					<p class="text-xs text-on-surface-subtle font-mono opacity-60">{setting.key}</p>
				</div>
				{#if isBooleanSetting(setting.value)}
					<div class="shrink-0 pt-0.5">
						<Switch
							checked={setting.value === 'true'}
							disabled={saving === setting.key}
							onCheckedChange={(checked) => handleToggle(setting.key, checked)}
						/>
					</div>
				{:else}
					<span class="text-sm text-on-surface font-mono shrink-0">{setting.value}</span>
				{/if}
			</div>
		{:else}
			<div class="px-5 py-8 text-center text-sm text-on-surface-subtle">
				No system settings found.
			</div>
		{/each}
	</div>
</div>
