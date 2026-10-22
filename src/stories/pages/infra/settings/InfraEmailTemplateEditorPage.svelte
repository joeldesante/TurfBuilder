<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Badge from '$components/data-display/badge/Badge.svelte';
	import ConfirmDialog from '$components/feedback/confirm-dialog/ConfirmDialog.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import CodeEditor from '$components/data-inputs/code-editor/CodeEditor.svelte';
	import { fillTemplate, unknownVariables } from '$lib/shared/utils/email-template';
	import type { EmailTemplateBody } from '$lib/shared/schemas/email-templates';
	import type { EmailTemplateDetail } from '$lib/shared/types/email-templates';

	interface Props {
		template: EmailTemplateDetail;
		/** Each resolves when done and rejects with an Error whose message is safe to show. */
		onsave: (body: EmailTemplateBody) => Promise<void>;
		/** Emails the given text to the admin; resolves with a message to show. */
		ontest: (body: EmailTemplateBody) => Promise<string>;
		onreset: () => Promise<void>;
	}

	let { template, onsave, ontest, onreset }: Props = $props();

	let subject = $state('');
	let htmlBody = $state('');
	// The saved text changes after a save or a reset; the editor starts from it.
	$effect(() => {
		subject = template.subject;
		htmlBody = template.htmlBody;
	});

	let editor = $state<ReturnType<typeof CodeEditor>>();
	let saving = $state(false);
	let testing = $state(false);
	let resetOpen = $state(false);
	let resetting = $state(false);
	let resetError = $state<string | null>(null);
	let notice = $state<{ kind: 'success' | 'error'; text: string } | null>(null);

	const dirty = $derived(subject !== template.subject || htmlBody !== template.htmlBody);
	const unknown = $derived(unknownVariables([subject, htmlBody], template.variables));
	const previewSubject = $derived(fillTemplate(subject, template.sample));
	const previewHtml = $derived(fillTemplate(htmlBody, template.sample));

	function body(): EmailTemplateBody {
		return { subject: subject.trim(), htmlBody };
	}

	async function run(kind: 'save' | 'test') {
		notice = null;
		if (kind === 'save') saving = true;
		else testing = true;
		try {
			const text = kind === 'save' ? (await onsave(body()), 'Saved.') : await ontest(body());
			notice = { kind: 'success', text };
		} catch (e) {
			notice = { kind: 'error', text: e instanceof Error ? e.message : 'That did not work. Try again.' };
		} finally {
			saving = false;
			testing = false;
		}
	}

	async function reset() {
		resetting = true;
		resetError = null;
		try {
			await onreset();
			resetOpen = false;
			notice = { kind: 'success', text: 'Back to the default text.' };
		} catch (e) {
			resetError = e instanceof Error ? e.message : 'That did not work. Try again.';
		} finally {
			resetting = false;
		}
	}
</script>

<PageHeader
	title={template.name}
	subheading={template.description}
	breadcrumbs={[
		{ label: 'Settings', href: '/infra/settings' },
		{ label: 'Email templates', href: '/infra/settings/email/templates' },
		{ label: template.name }
	]}
>
	{#snippet actions()}
		<Button variant="outline" onclick={() => run('test')} loading={testing}>Send test to me</Button>
		{#if template.customized}
			<Button variant="outline" onclick={() => ((resetError = null), (resetOpen = true))}>Reset to default</Button>
		{/if}
		<Button onclick={() => run('save')} loading={saving} disabled={!dirty}>Save</Button>
	{/snippet}
</PageHeader>

<div class="space-y-6">
	{#if notice}
		<p role={notice.kind === 'error' ? 'alert' : 'status'} class={['text-sm', notice.kind === 'error' ? 'text-error' : 'text-on-surface']}>
			{notice.text}
		</p>
	{/if}

	{#if template.customized}<div><Badge size="sm" variant="info">Edited from the default</Badge></div>{/if}

	<FormField label="Subject">
		<TextInput bind:value={subject} />
	</FormField>

	<section aria-labelledby="variables-heading">
		<h2 id="variables-heading" class="text-sm font-medium text-on-surface">Variables</h2>
		<p class="text-sm text-on-surface-subtle">Select one to put it at the cursor in the body. Each is replaced with a real value when the email is sent.</p>
		<ul class="mt-2 flex flex-wrap gap-2">
			{#each template.variables as variable (variable)}
				<li>
					<button
						type="button"
						class="rounded-md bg-surface-container-high px-2 py-1 font-mono text-xs text-on-surface hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary"
						onclick={() => editor?.insert(`{{${variable}}}`)}
					>
						{`{{${variable}}}`}
					</button>
				</li>
			{/each}
		</ul>
	</section>

	{#if unknown.length > 0}
		<p role="status" class="rounded-lg border border-warning bg-warning-container px-4 py-2 text-sm text-on-warning-container">
			{unknown.map((name) => `{{${name}}}`).join(', ')}
			{unknown.length === 1 ? 'is' : 'are'} not provided by this email and will be blank.
		</p>
	{/if}

	<div class="grid gap-4 lg:grid-cols-2">
		<div class="space-y-1.5">
			<h2 class="text-sm font-medium text-on-surface">HTML</h2>
			<CodeEditor bind:this={editor} bind:value={htmlBody} label="Email body HTML" minHeight={420} />
		</div>
		<div class="space-y-1.5">
			<h2 class="text-sm font-medium text-on-surface">Preview</h2>
			<p class="text-sm text-on-surface-subtle">Subject: {previewSubject}</p>
			<iframe
				srcdoc={previewHtml}
				title="Email preview"
				sandbox=""
				class="w-full rounded-md border border-outline bg-white"
				style="min-height: 420px;"
			></iframe>
		</div>
	</div>
</div>

<ConfirmDialog
	open={resetOpen}
	title="Reset to the default text?"
	description="Your edits to this email are replaced with the text the app shipped with. This cannot be undone."
	confirmLabel="Reset"
	destructive
	loading={resetting}
	error={resetError}
	onCancel={() => !resetting && (resetOpen = false)}
	onConfirm={reset}
/>
