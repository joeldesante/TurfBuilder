<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Select from '$components/data-inputs/select/Select.svelte';

	interface Setting {
		key: string;
		value: string;
		description: string | null;
	}

	interface Props {
		settings: Setting[];
		onSave: (key: string, value: string) => Promise<void>;
	}

	const { settings, onSave }: Props = $props();

	const transportOptions = [
		{ value: 'direct', label: 'Direct Send' },
		{ value: 'ses', label: 'Amazon SES' }
	];

	function getValue(key: string): string {
		return settings.find((s) => s.key === key)?.value ?? '';
	}

	let transport = $state(getValue('mail.transport') || 'direct');
	let domain = $state(getValue('mail.domain'));
	let sesRegion = $state(getValue('mail.ses.region'));

	let saving = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function handleSave(key: string, value: string) {
		saving = key;
		error = null;
		try {
			await onSave(key, value);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save setting.';
		} finally {
			saving = null;
		}
	}

	function settingRow(label: string, key: string, value: string, description: string, placeholder = '') {
		return { label, key, value, description, placeholder };
	}
</script>

<PageHeader
	title="Email"
	subheading="Configure outgoing email delivery for this installation."
/>

<div class="p-6 space-y-6 max-w-2xl">
	{#if error}
		<div class="rounded-lg border border-error bg-error/10 px-4 py-3 text-sm text-error">
			{error}
		</div>
	{/if}

	<div class="rounded-lg border border-outline overflow-hidden divide-y divide-outline">

		<div class="flex flex-col gap-3 px-5 py-4 bg-surface-container-low">
			<div class="space-y-0.5">
				<p class="text-sm font-medium text-on-surface">Mail Transport</p>
				<p class="text-xs text-on-surface-subtle">The service used to deliver outgoing emails.</p>
				<p class="text-xs text-on-surface-subtle font-mono opacity-60">mail.transport</p>
			</div>
			<div class="flex flex-col gap-2">
				<Select items={transportOptions} bind:value={transport} disabled={saving === 'mail.transport'} />
				<div class="flex justify-end">
					<button
						class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-on-primary disabled:opacity-50"
						disabled={saving === 'mail.transport'}
						onclick={() => handleSave('mail.transport', transport)}
					>
						{saving === 'mail.transport' ? 'Saving…' : 'Save'}
					</button>
				</div>
			</div>
		</div>

		<div class="flex flex-col gap-3 px-5 py-4 bg-surface-container-low">
			<div class="space-y-0.5">
				<p class="text-sm font-medium text-on-surface">Email Domain</p>
				<p class="text-xs text-on-surface-subtle">The domain from which outgoing emails are sent (e.g. mail.example.com).</p>
				<p class="text-xs text-on-surface-subtle font-mono opacity-60">mail.domain</p>
			</div>
			<div class="flex flex-col gap-2">
				<input
					type="text"
					bind:value={domain}
					placeholder="mail.example.com"
					disabled={saving === 'mail.domain'}
					class="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
				/>
				<div class="flex justify-end">
					<button
						class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-on-primary disabled:opacity-50"
						disabled={saving === 'mail.domain'}
						onclick={() => handleSave('mail.domain', domain)}
					>
						{saving === 'mail.domain' ? 'Saving…' : 'Save'}
					</button>
				</div>
			</div>
		</div>

		{#if transport === 'ses'}
			<div class="flex flex-col gap-3 px-5 py-4 bg-surface-container-low">
				<div class="space-y-0.5">
					<p class="text-sm font-medium text-on-surface">AWS Region</p>
					<p class="text-xs text-on-surface-subtle">The AWS region where your SES sending identity is configured (e.g. us-east-1).</p>
					<p class="text-xs text-on-surface-subtle font-mono opacity-60">mail.ses.region</p>
				</div>
				<div class="flex flex-col gap-2">
					<input
						type="text"
						bind:value={sesRegion}
						placeholder="us-east-1"
						disabled={saving === 'mail.ses.region'}
						class="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
					/>
					<div class="flex justify-end">
						<button
							class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-on-primary disabled:opacity-50"
							disabled={saving === 'mail.ses.region'}
							onclick={() => handleSave('mail.ses.region', sesRegion)}
						>
							{saving === 'mail.ses.region' ? 'Saving…' : 'Save'}
						</button>
					</div>
				</div>
			</div>

		{/if}

	</div>
</div>
