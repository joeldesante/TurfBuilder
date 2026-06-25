<script lang="ts">
	import { untrack } from 'svelte';
	import { onMount, onDestroy } from 'svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';

	interface Props {
		templateKey: string;
		subject: string;
		htmlBody: string;
		variables: string[];
		updatedAt: string;
		onSave: (subject: string, htmlBody: string) => Promise<void>;
	}

	const { templateKey, subject: initialSubject, htmlBody: initialHtmlBody, variables, onSave }: Props = $props();

	let subject = $state(untrack(() => initialSubject));
	let htmlBody = $state(untrack(() => initialHtmlBody));
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let savedAt = $state<Date | null>(null);

	async function handleSave() {
		saving = true;
		saveError = null;
		try {
			await onSave(subject, htmlBody);
			savedAt = new Date();
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Failed to save template.';
		} finally {
			saving = false;
		}
	}

	let editorContainer: HTMLDivElement;
	let editorView: import('@codemirror/view').EditorView | null = null;

	onMount(async () => {
		const { EditorView, keymap } = await import('@codemirror/view');
		const { EditorState } = await import('@codemirror/state');
		const { html } = await import('@codemirror/lang-html');
		const { oneDark } = await import('@codemirror/theme-one-dark');
		const { basicSetup } = await import('codemirror');
		const { defaultKeymap, indentWithTab } = await import('@codemirror/commands');

		editorView = new EditorView({
			state: EditorState.create({
				doc: htmlBody,
				extensions: [
					basicSetup,
					html(),
					oneDark,
					keymap.of([...defaultKeymap, indentWithTab]),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							htmlBody = update.state.doc.toString();
						}
					})
				]
			}),
			parent: editorContainer
		});
	});

	onDestroy(() => {
		editorView?.destroy();
	});
</script>

<PageHeader
	title={subject || templateKey}
	subheading={templateKey}
	breadcrumbs={[
		{ label: 'Email Templates', href: '/infra/email/templates' },
		{ label: subject || templateKey }
	]}
>
	{#snippet actions()}
		<Button onclick={handleSave} loading={saving}>
			{saving ? 'Saving…' : 'Save'}
		</Button>
	{/snippet}
</PageHeader>

{#if saveError}
	<div class="mx-6 mb-4 rounded-lg border border-error bg-error/10 px-4 py-3 text-sm text-error">
		{saveError}
	</div>
{/if}

{#if savedAt}
	<div class="mx-6 mb-4 rounded-lg border border-outline bg-surface-container px-4 py-3 text-sm text-on-surface-subtle">
		Saved {savedAt.toLocaleTimeString()}
	</div>
{/if}

<div class="px-6 pb-6 space-y-6">
	<div class="space-y-1.5">
		<label for="subject" class="text-sm font-medium text-on-surface">Subject</label>
		<input
			id="subject"
			type="text"
			bind:value={subject}
			class="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
		/>
	</div>

	{#if variables.length > 0}
		<div class="rounded-lg border border-outline-subtle bg-surface-container px-4 py-3 text-sm">
			<p class="font-medium text-on-surface mb-1.5">Available variables</p>
			<div class="flex flex-wrap gap-2">
				{#each variables as variable}
					<code class="rounded bg-surface-container-high px-2 py-0.5 text-xs font-mono text-on-surface">{`{{${variable}}}`}</code>
				{/each}
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-2 gap-4" style="min-height: 500px;">
		<div class="flex flex-col gap-1.5">
			<p class="text-sm font-medium text-on-surface">HTML Source</p>
			<div
				bind:this={editorContainer}
				class="flex-1 rounded-md border border-outline overflow-hidden"
				style="min-height: 480px;"
			></div>
		</div>

		<div class="flex flex-col gap-1.5">
			<p class="text-sm font-medium text-on-surface">Preview</p>
			<iframe
				srcdoc={htmlBody}
				title="Email preview"
				sandbox="allow-same-origin"
				class="flex-1 w-full rounded-md border border-outline bg-white"
				style="min-height: 480px;"
			></iframe>
		</div>
	</div>
</div>

<style>
	:global(.cm-editor) {
		height: 100%;
		font-size: 0.8125rem;
	}

	:global(.cm-scroller) {
		font-family: ui-monospace, monospace;
	}
</style>
