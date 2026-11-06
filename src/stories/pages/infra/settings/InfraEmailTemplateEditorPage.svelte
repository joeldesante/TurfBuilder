<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Badge from '$components/data-display/badge/Badge.svelte';
	import ConfirmDialog from '$components/feedback/confirm-dialog/ConfirmDialog.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import CodeEditor from '$components/data-inputs/code-editor/CodeEditor.svelte';
	import { fillTemplate, unknownVariables } from '$lib/shared/utils/email-template';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { emailTemplateBodySchema, type EmailTemplateBody } from '$lib/shared/schemas/email-templates';
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

	let notice = $state<{ kind: 'success' | 'error'; text: string } | null>(null);

	const form = new Form(emailTemplateBodySchema, async (values) => {
		await onsave({ subject: values.subject, htmlBody: values.htmlBody });
		notice = { kind: 'success', text: 'Saved.' };
	});

	// The saved text changes after a save or a reset; the editor starts from it.
	$effect(() => {
		form.values.subject = template.subject;
		form.values.htmlBody = template.htmlBody;
	});

	let editor = $state<ReturnType<typeof CodeEditor>>();
	let testing = $state(false);
	let resetOpen = $state(false);
	let resetting = $state(false);
	let resetError = $state<string | null>(null);

	const dirty = $derived(
		form.values.subject !== template.subject || form.values.htmlBody !== template.htmlBody
	);
	const unknown = $derived(unknownVariables([form.values.subject, form.values.htmlBody], template.variables));
	const previewSubject = $derived(fillTemplate(form.values.subject, template.sample));
	const previewHtml = $derived(fillTemplate(form.values.htmlBody, template.sample));

	async function save() {
		notice = null;
		await form.submit();
	}

	async function sendTest() {
		notice = null;
		// Same checks as saving, so the server is not sent text it will refuse.
		form.touch('subject');
		form.touch('htmlBody');
		if (!form.valid) return;
		testing = true;
		try {
			const text = await ontest({ subject: form.values.subject.trim(), htmlBody: form.values.htmlBody });
			notice = { kind: 'success', text };
		} catch (e) {
			notice = { kind: 'error', text: e instanceof Error ? e.message : 'That did not work. Try again.' };
		} finally {
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
		<Button variant="outline" onclick={sendTest} loading={testing}>Send test to me</Button>
		{#if template.customized}
			<Button variant="outline" onclick={() => ((resetError = null), (resetOpen = true))}>Reset to default</Button>
		{/if}
		<Button onclick={save} loading={form.submitting} disabled={!dirty}>Save</Button>
	{/snippet}
</PageHeader>

<div class="space-y-6">
	{#if form.errorMessage}
		<p role="alert" class="text-sm text-error">{form.errorMessage}</p>
	{:else if notice}
		<p role={notice.kind === 'error' ? 'alert' : 'status'} class={['text-sm', notice.kind === 'error' ? 'text-error' : 'text-on-surface']}>
			{notice.text}
		</p>
	{/if}

	{#if template.customized}<div><Badge size="sm" variant="info">Edited from the default</Badge></div>{/if}

	<FormField label="Subject" errors={form.errors.subject ?? []} dirty={!!form.touched.subject}>
		<TextInput bind:value={form.values.subject} onfocusout={() => form.touch('subject')} />
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
			<CodeEditor bind:this={editor} bind:value={form.values.htmlBody} label="Email body HTML" minHeight={420} />
			{#if form.touched.htmlBody && form.errors.htmlBody}
				<p role="alert" class="text-sm text-error">{form.errors.htmlBody[0]}</p>
			{/if}
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
