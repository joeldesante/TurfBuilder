<script lang="ts">
	import { untrack, onMount } from 'svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import RichTextEditor from '$components/data-inputs/rich-text-editor/RichTextEditor.svelte';

	interface Props {
		scriptName: string;
		bucketName: string;
		initialContent: string;
		onSave: (content: string) => Promise<void>;
	}

	const { scriptName, bucketName, initialContent, onSave }: Props = $props();

	let content = $state(untrack(() => initialContent));
	let error = $state('');
	let saveStatus: 'saving' | 'saved' | null = $state('saved');

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let saveShortcutTimer: ReturnType<typeof setTimeout> | null = null;

	const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

	async function handleSave() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		saveStatus = 'saving';
		const start = Date.now();
		try {
			await onSave(content);
			await sleep(Math.max(0, 1000 - (Date.now() - start)));
			saveStatus = 'saved';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save.';
			saveStatus = null;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			if (saveShortcutTimer) return;
			handleSave();
			saveShortcutTimer = setTimeout(() => (saveShortcutTimer = null), 3000);
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});

	function handleChange(md: string) {
		content = md;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(handleSave, 350);
	}
</script>

<PageHeader title={scriptName} subheading={bucketName} />

{#if error}
	<p class="mb-4 text-sm text-red-600" role="alert">{error}</p>
{/if}

<RichTextEditor value={initialContent} onchange={handleChange} {saveStatus} />
