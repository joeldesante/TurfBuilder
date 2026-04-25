<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Switch from '$components/data-inputs/switch/Switch.svelte';
	import TagInput from '$components/data-inputs/tag-input/TagInput.svelte';

	interface Setting {
		key: string;
		value: string;
		description: string | null;
	}

	interface Props {
		settings: Setting[];
		onToggle: (key: string, value: boolean) => Promise<void>;
		onSave: (key: string, value: string) => Promise<void>;
	}

	const { settings, onToggle, onSave }: Props = $props();

	let saving = $state<string | null>(null);
	let error = $state<string | null>(null);
	let textValues = $state<Record<string, string>>({});
	$effect(() => {
		for (const s of settings) {
			textValues[s.key] = s.value;
		}
	});

	const TAG_SETTINGS = new Set(['base_url']);

	function isBooleanSetting(value: string) {
		return value === 'true' || value === 'false';
	}

	function isTagSetting(key: string) {
		return TAG_SETTINGS.has(key);
	}

	function tagsFromValue(value: string): string[] {
		return value.split('\n').map((s) => s.trim()).filter(Boolean);
	}

	function valueFromTags(tags: string[]): string {
		return tags.join('\n');
	}

	function labelForKey(key: string): string {
		const labels: Record<string, string> = {
			'organizations.allow_creation': 'Allow Organization Creation',
			'html.header_content': 'Additional Header Content'
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

	async function handleSave(key: string) {
		saving = key;
		error = null;
		try {
			await onSave(key, textValues[key]);
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
			<div class="flex flex-col gap-3 px-5 py-4 bg-surface-container-low">
				<div class="flex items-start justify-between gap-4">
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
					{/if}
				</div>
				{#if !isBooleanSetting(setting.value)}
					<div class="flex flex-col gap-2">
						{#if isTagSetting(setting.key)}
							<TagInput
								tags={tagsFromValue(textValues[setting.key] ?? '')}
								placeholder="Type a domain and press Enter…"
								disabled={saving === setting.key}
								onchange={(tags) => { textValues[setting.key] = valueFromTags(tags); }}
							/>
						{:else}
							<textarea
								class="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm font-mono text-on-surface resize-y min-h-24 focus:outline-none focus:ring-2 focus:ring-primary"
								bind:value={textValues[setting.key]}
								disabled={saving === setting.key}
								placeholder="Empty"
							></textarea>
						{/if}
						<div class="flex justify-end">
							<button
								class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-on-primary disabled:opacity-50"
								disabled={saving === setting.key}
								onclick={() => handleSave(setting.key)}
							>
								{saving === setting.key ? 'Saving…' : 'Save'}
							</button>
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="px-5 py-8 text-center text-sm text-on-surface-subtle">
				No system settings found.
			</div>
		{/each}
	</div>
</div>
