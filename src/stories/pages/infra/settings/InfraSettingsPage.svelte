<script lang="ts" module>
	export type SaveResult =
		| { ok: true; restartRequired: boolean }
		| { ok: false; message: string; errors: Record<string, string> };

	/** Which environment-provided credentials exist; their values are never sent to the page. */
	export interface CredentialStatus {
		aws: boolean;
		storageAccessKey: boolean;
		storageSecretKey: boolean;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { z } from 'zod';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Tabs from '$components/layout/tabs/Tabs.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import Textarea from '$components/data-inputs/textarea/Textarea.svelte';
	import Select from '$components/data-inputs/select/Select.svelte';
	import Switch from '$components/data-inputs/switch/Switch.svelte';
	import CodeEditor from '$components/data-inputs/code-editor/CodeEditor.svelte';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { SETTING_GROUPS, SYSTEM_SETTINGS, type SettingDefinition, type SettingGroup } from '$lib/shared/registries/system-settings';
	import { formatDateTime } from '$lib/shared/utils/format-date';
	import type { SystemSettingValue } from '$lib/shared/types/system-settings';

	interface Props {
		settings: SystemSettingValue[];
		tab: SettingGroup;
		credentials: CredentialStatus;
		/** Saves the changed values. Never rejects; failures come back as a result. */
		onsave: (values: Record<string, string>) => Promise<SaveResult>;
		/** Each resolves with a message to show, or rejects with an Error whose message is safe to show. */
		ontestmail: () => Promise<string>;
		onteststorage: () => Promise<string>;
	}

	let { settings, tab, credentials, onsave, ontestmail, onteststorage }: Props = $props();

	const group = $derived(SETTING_GROUPS.find((g) => g.id === tab) ?? SETTING_GROUPS[0]);
	const definitions = $derived(SYSTEM_SETTINGS.filter((s) => s.group === group.id));
	const stored = $derived(new Map(settings.map((s) => [s.key, s])));

	let notice = $state<{ kind: 'success' | 'error'; text: string } | null>(null);

	const storedValue = (key: string) => stored.get(key)?.value ?? '';

	/**
	 * A field is checked with its setting's own validator, but only when the admin changed it: a
	 * stored value that is no longer valid (a default, or one saved before a rule tightened) must
	 * not stop an unrelated change from saving. The server checks again.
	 */
	function settingFieldSchema(def: SettingDefinition) {
		return z.string().superRefine((value, ctx) => {
			if (value === storedValue(def.key)) return;
			const checked = def.schema.safeParse(value);
			if (checked.success) return;
			for (const issue of checked.error.issues) ctx.addIssue({ code: 'custom', message: issue.message });
		});
	}

	// One form per tab, holding the value of every field on it. Switching tabs starts a new form, so
	// edits made on the last tab are not saved, unseen, with this one.
	function createForm() {
		const shape: Record<string, z.ZodType<string>> = {};
		const initial: Record<string, string> = {};
		for (const def of definitions) {
			shape[def.key] = settingFieldSchema(def);
			initial[def.key] = storedValue(def.key);
		}
		return new Form(z.object(shape), save, initial);
	}

	let form = $state.raw(untrack(createForm));

	const valueOf = (key: string) => form.values[key] ?? '';
	const dirtyKeys = $derived(
		definitions.map((def) => def.key).filter((key) => valueOf(key) !== storedValue(key))
	);
	const saving = $derived(form.submitting);

	function edit(key: string, value: string) {
		form.values[key] = value;
		form.clearFieldError(key);
		notice = null;
	}

	async function save(values: Record<string, string>) {
		notice = null;
		const result = await onsave(Object.fromEntries(dirtyKeys.map((key) => [key, values[key]])));
		if (result.ok) {
			notice = {
				kind: 'success',
				text: result.restartRequired ? 'Saved. Restart the app for the change to take effect everywhere.' : 'Saved.'
			};
			return;
		}
		for (const def of definitions) {
			const message = result.errors[def.key];
			if (message) form.setFieldError(def.key, message);
		}
		notice = { kind: 'error', text: result.message };
	}

	function discard() {
		for (const def of definitions) {
			form.clearFieldError(def.key);
			form.values[def.key] = storedValue(def.key);
		}
		notice = null;
	}

	// When the saved settings change (after a save the page reloads them), fields the admin has not
	// edited follow along. An edited field keeps what was typed.
	let previousStored = untrack(() => stored);
	$effect(() => {
		const next = stored;
		untrack(() => {
			for (const def of definitions) {
				if (valueOf(def.key) === (previousStored.get(def.key)?.value ?? '')) {
					form.values[def.key] = next.get(def.key)?.value ?? '';
				}
			}
			previousStored = next;
		});
	});

	// The test buttons.
	let testing = $state<'mail' | 'storage' | null>(null);
	let testResult = $state<{ kind: 'success' | 'error'; text: string } | null>(null);

	// Switching tabs keeps this component, so edits made on the last tab would
	// otherwise be saved, unseen, with this one. Each tab starts clean.
	let shownTab = $state<SettingGroup | null>(untrack(() => tab));
	$effect.pre(() => {
		if (tab === shownTab) return;
		shownTab = tab;
		form = untrack(createForm);
		notice = null;
		testResult = null;
	});

	async function runTest(which: 'mail' | 'storage') {
		testing = which;
		testResult = null;
		try {
			testResult = { kind: 'success', text: await (which === 'mail' ? ontestmail() : onteststorage()) };
		} catch (e) {
			testResult = { kind: 'error', text: e instanceof Error ? e.message : 'The test failed.' };
		} finally {
			testing = null;
		}
	}

	// Links are stored as JSON text; the editor works on rows.
	function readLinks(text: string): { label: string; url: string }[] {
		try {
			const parsed = JSON.parse(text);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	function writeLinks(key: string, rows: { label: string; url: string }[]) {
		edit(key, JSON.stringify(rows));
	}

	const tabs = $derived(SETTING_GROUPS.map((g) => ({ id: g.id, label: g.label, href: `?tab=${g.id}` })));
	const saved = (key: string) => stored.get(key)?.updatedAt ?? null;
	const credentialText = (present: boolean, name: string) => `${name}: ${present ? 'set' : 'not set'}`;
</script>

<PageHeader title="Settings" subheading="Configure this instance." />

<div class="space-y-6">
	<Tabs {tabs} active={group.id} label="Settings sections" />

	<form
		class="max-w-2xl space-y-6"
		onsubmit={(event) => {
			event.preventDefault();
			if (dirtyKeys.length > 0 && !saving) form.submit();
		}}
	>
		<p class="text-sm text-on-surface-subtle">{group.description}</p>

		{#each definitions as def (def.key)}
			{@render field(def)}
		{/each}

		{#if group.id === 'email'}
			<div class="space-y-2 rounded-xl border border-outline-subtle p-4">
				<p class="text-sm text-on-surface">
					{credentialText(credentials.aws, 'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (Amazon SES)')}.
				</p>
				<Button type="button" variant="outline" loading={testing === 'mail'} onclick={() => runTest('mail')}>
					Send a test email to me
				</Button>
				<p class="text-xs text-on-surface-subtle">Uses the saved settings, so save changes first.</p>
				{#if testResult && testing === null}
					<p role={testResult.kind === 'error' ? 'alert' : 'status'} class={['text-sm', testResult.kind === 'error' ? 'text-error' : 'text-on-surface']}>
						{testResult.text}
					</p>
				{/if}
			</div>
		{:else if group.id === 'storage'}
			<div class="space-y-2 rounded-xl border border-outline-subtle p-4">
				<p class="text-sm text-on-surface">
					{credentialText(credentials.storageAccessKey, 'SPACES_ACCESS_KEY_ID')}. {credentialText(credentials.storageSecretKey, 'SPACES_SECRET_ACCESS_KEY')}.
				</p>
				<Button type="button" variant="outline" loading={testing === 'storage'} onclick={() => runTest('storage')}>
					Test connection
				</Button>
				<p class="text-xs text-on-surface-subtle">Writes and removes a small file in the bucket, using the saved settings.</p>
				{#if testResult && testing === null}
					<p role={testResult.kind === 'error' ? 'alert' : 'status'} class={['text-sm', testResult.kind === 'error' ? 'text-error' : 'text-on-surface']}>
						{testResult.text}
					</p>
				{/if}
			</div>
		{/if}

		{#if notice}
			<p role={notice.kind === 'error' ? 'alert' : 'status'} class={['text-sm', notice.kind === 'error' ? 'text-error' : 'text-on-surface']}>
				{notice.text}
			</p>
		{/if}

		<div class="flex gap-2">
			<Button type="submit" loading={saving} disabled={dirtyKeys.length === 0}>Save changes</Button>
			{#if dirtyKeys.length > 0 && !saving}
				<Button type="button" variant="ghost" onclick={discard}>Discard</Button>
			{/if}
		</div>
	</form>
</div>

{#snippet field(def: SettingDefinition)}
	{@const value = valueOf(def.key)}
	{@const error = form.errors[def.key]?.[0]}
	{#if def.input.kind === 'boolean'}
		<div>
			<Switch id={`setting-${def.key}`} checked={value === 'true'} onCheckedChange={(next) => edit(def.key, String(next))}>{def.label}</Switch>
			<p class="mt-1 text-sm text-on-surface-subtle">{def.help}</p>
			{#if error}<p class="mt-1 text-sm text-error" role="alert">{error}</p>{/if}
		</div>
	{:else}
		<FormField label={def.label} helperText={def.help} errors={form.errors[def.key] ?? []} dirty>
			{#if def.input.kind === 'text' || def.input.kind === 'url'}
				<TextInput
					{value}
					type={def.input.kind === 'url' ? 'url' : 'text'}
					placeholder={def.input.placeholder}
					oninput={(event: Event) => edit(def.key, (event.currentTarget as HTMLInputElement).value)}
				/>
			{:else if def.input.kind === 'url-list'}
				<Textarea {value} rows={3} oninput={(event: Event) => edit(def.key, (event.currentTarget as HTMLTextAreaElement).value)} />
			{:else if def.input.kind === 'number'}
				<div class="flex items-center gap-2">
					<TextInput
						{value}
						type="text"
						inputmode="numeric"
						class="w-32"
						oninput={(event: Event) => edit(def.key, (event.currentTarget as HTMLInputElement).value)}
					/>
					{#if def.input.unit}<span class="text-sm text-on-surface-subtle">{def.input.unit}</span>{/if}
				</div>
			{:else if def.input.kind === 'select'}
				<Select {value} items={def.input.options} onchange={(event: Event) => edit(def.key, (event.currentTarget as HTMLSelectElement).value)} />
			{:else if def.input.kind === 'html'}
				<CodeEditor label={def.label} {value} minHeight={160} onchange={(next) => edit(def.key, next)} />
			{:else if def.input.kind === 'links'}
				{@const rows = readLinks(value)}
				<div class="space-y-2">
					{#each rows as row, i (i)}
						<div class="flex flex-wrap items-center gap-2">
							<TextInput
								value={row.label}
								placeholder="Label"
								aria-label={`Link ${i + 1} label`}
								class="w-40"
								oninput={(event: Event) => writeLinks(def.key, rows.map((r, j) => (j === i ? { ...r, label: (event.currentTarget as HTMLInputElement).value } : r)))}
							/>
							<TextInput
								value={row.url}
								type="url"
								placeholder="https://"
								aria-label={`Link ${i + 1} address`}
								class="min-w-0 flex-1"
								oninput={(event: Event) => writeLinks(def.key, rows.map((r, j) => (j === i ? { ...r, url: (event.currentTarget as HTMLInputElement).value } : r)))}
							/>
							<Button type="button" variant="ghost" size="sm" aria-label={`Remove link ${i + 1}`} onclick={() => writeLinks(def.key, rows.filter((_, j) => j !== i))}>
								Remove
							</Button>
						</div>
					{/each}
					<Button type="button" variant="outline" size="sm" onclick={() => writeLinks(def.key, [...rows, { label: '', url: '' }])}>Add a link</Button>
				</div>
			{/if}
		</FormField>
		{#if saved(def.key)}
			<p class="-mt-4 text-xs text-on-surface-subtle">Last saved {formatDateTime(saved(def.key)!)}</p>
		{/if}
	{/if}
{/snippet}
