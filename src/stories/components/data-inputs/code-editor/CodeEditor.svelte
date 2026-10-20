<script lang="ts">
	import { onMount } from 'svelte';
	import type { EditorView } from '@codemirror/view';

	interface Props {
		value?: string;
		/** Names the editor for screen readers. */
		label: string;
		language?: 'html' | 'plain';
		/** Minimum height of the editing area in px. */
		minHeight?: number;
		readonly?: boolean;
		onchange?: (value: string) => void;
		class?: string;
	}

	let { value = $bindable(''), label, language = 'html', minHeight = 240, readonly = false, onchange, class: className = '' }: Props = $props();

	let host: HTMLDivElement;
	let view: EditorView | null = null;

	onMount(() => {
		let disposed = false;

		(async () => {
			const [{ EditorView, keymap }, { EditorState }, { basicSetup }, { defaultKeymap, indentWithTab }] = await Promise.all([
				import('@codemirror/view'),
				import('@codemirror/state'),
				import('codemirror'),
				import('@codemirror/commands')
			]);
			const extensions = [
				basicSetup,
				keymap.of([...defaultKeymap, indentWithTab]),
				EditorView.lineWrapping,
				EditorView.contentAttributes.of({ 'aria-label': label }),
				EditorState.readOnly.of(readonly),
				EditorView.theme({ '&': { minHeight: `${minHeight}px`, fontSize: '0.8125rem' }, '.cm-scroller': { fontFamily: 'ui-monospace, monospace' } }),
				EditorView.updateListener.of((update) => {
					if (!update.docChanged) return;
					value = update.state.doc.toString();
					onchange?.(value);
				})
			];
			if (language === 'html') extensions.push((await import('@codemirror/lang-html')).html());
			if (document.documentElement.dataset.theme === 'dark') extensions.push((await import('@codemirror/theme-one-dark')).oneDark);

			if (disposed) return;
			view = new EditorView({ state: EditorState.create({ doc: value, extensions }), parent: host });
		})();

		return () => {
			disposed = true;
			view?.destroy();
			view = null;
		};
	});

	/** Types `text` at the cursor, replacing any selection, and keeps focus in the editor. */
	export function insert(text: string) {
		if (!view) return;
		const { from, to } = view.state.selection.main;
		view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
		view.focus();
	}

	// A change from outside, such as "Reset to default", replaces the document.
	$effect(() => {
		const next = value;
		if (view && view.state.doc.toString() !== next) {
			view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
		}
	});
</script>

<div bind:this={host} class={['overflow-hidden rounded-md border border-outline bg-surface', className]}></div>
