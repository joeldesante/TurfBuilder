<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { onMount, onDestroy } from 'svelte';
	import type { Carta } from 'carta-md';
	import { CartaEditor } from 'carta-md';
	import remarkIns from 'remark-ins';
	import 'carta-md/default.css';
	import { Toolbar } from 'bits-ui';
	import Tooltip from '$components/feedback/tooltip/Tooltip.svelte';
	import TextBIcon from 'phosphor-svelte/lib/TextBIcon';
	import TextItalicIcon from 'phosphor-svelte/lib/TextItalicIcon';
	import TextUnderlineIcon from 'phosphor-svelte/lib/TextUnderlineIcon';
	import TextHOneIcon from 'phosphor-svelte/lib/TextHOneIcon';
	import TextHTwoIcon from 'phosphor-svelte/lib/TextHTwoIcon';
	import EyeIcon from 'phosphor-svelte/lib/EyeIcon';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlashIcon';
	import BookOpenIcon from 'phosphor-svelte/lib/BookOpenIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';

	interface Props {
		value?: string;
		onchange?: (markdown: string) => void;
		saveStatus?: 'saving' | 'saved' | null;
	}

	const { value = '', onchange, saveStatus = null }: Props = $props();

	let carta: Carta | null = $state(null);
	let content = $state(untrack(() => value));
	let previewing = $state(true);
	let showCheatsheet = $state(false);
	let windowWidth = $state(browser ? window.innerWidth : 0);
	const isMac = browser && /mac/i.test(navigator.platform);

	$effect(() => {
		onchange?.(content);
	});

	let savedSelection: [number, number] = [0, 0];

	function saveSelection() {
		const ta = carta?.input?.textarea;
		if (ta) savedSelection = [ta.selectionStart, ta.selectionEnd];
	}

	function applyFormat(
		fn: (input: NonNullable<typeof carta>['input']) => void,
		selection?: [number, number]
	) {
		const input = carta?.input;
		if (!input) return;
		input.textarea.focus();
		let [start, end] = selection ?? savedSelection;
		while (start < end && /[\r\n]/.test(input.textarea.value[start])) start++;
		while (end > start && /[\r\n]/.test(input.textarea.value[end - 1])) end--;
		input.textarea.setSelectionRange(start, end);
		fn(input);
		input.textarea.dispatchEvent(new Event('input'));
	}

	function handleShortcut(e: KeyboardEvent) {
		if (!e.metaKey && !e.ctrlKey) return;
		const ta = carta?.input?.textarea;
		if (!ta) return;
		const sel: [number, number] = [ta.selectionStart, ta.selectionEnd];
		if (e.key === 'b') {
			e.preventDefault();
			applyFormat((i) => i?.toggleSelectionSurrounding('**'), sel);
		}
		if (e.key === 'i') {
			e.preventDefault();
			applyFormat((i) => i?.toggleSelectionSurrounding('_'), sel);
		}
		if (e.key === 'u') {
			e.preventDefault();
			applyFormat((i) => i?.toggleSelectionSurrounding('++'), sel);
		}
	}

	function bold() {
		applyFormat((input) => input?.toggleSelectionSurrounding('**'));
	}

	function italic() {
		applyFormat((input) => input?.toggleSelectionSurrounding('_'));
	}

	function underline() {
		applyFormat((input) => input?.toggleSelectionSurrounding('++'));
	}

	function heading(level: 1 | 2) {
		applyFormat((input) => input?.toggleLinePrefix('#'.repeat(level) + ' '));
	}

	let cleanupResize: (() => void) | null = null;

	onMount(async () => {
		const handleResize = () => (windowWidth = window.innerWidth);
		window.addEventListener('resize', handleResize);
		cleanupResize = () => window.removeEventListener('resize', handleResize);

		const { Carta: CartaClass } = await import('carta-md');
		const DOMPurify = (await import('dompurify')).default;

		carta = new CartaClass({
			sanitizer: DOMPurify.sanitize,
			disableShortcuts: ['bold', 'italic'],
			extensions: [
				{
					transformers: [
						{
							execution: 'sync',
							type: 'remark',
							transform({ processor }) {
								processor.use(remarkIns);
							}
						}
					]
				}
			]
		});
	});

	onDestroy(() => cleanupResize?.());

	const btnClass =
		'inline-flex items-center justify-center size-9 rounded-sm text-on-surface-subtle transition-all hover:bg-surface-container-highest hover:text-on-surface active:scale-95 cursor-pointer';
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="flex flex-col gap-3" role="group" onkeydown={handleShortcut}>
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<Toolbar.Root
				class="flex h-11 w-fit items-center gap-0.5 rounded-xl border border-outline-subtle bg-surface-container px-2 shadow-sm"
			>
				<Tooltip text="Bold" side="bottom">
					<Toolbar.Button
						onmousedown={saveSelection}
						onclick={bold}
						aria-label="Bold"
						class={btnClass}
					>
						<TextBIcon size={16} />
					</Toolbar.Button>
				</Tooltip>
				<Tooltip text="Italic" side="bottom">
					<Toolbar.Button
						onmousedown={saveSelection}
						onclick={italic}
						aria-label="Italic"
						class={btnClass}
					>
						<TextItalicIcon size={16} />
					</Toolbar.Button>
				</Tooltip>
				<Tooltip text="Underline" side="bottom">
					<Toolbar.Button
						onmousedown={saveSelection}
						onclick={underline}
						aria-label="Underline"
						class={btnClass}
					>
						<TextUnderlineIcon size={16} />
					</Toolbar.Button>
				</Tooltip>
				<div class="mx-1 h-5 w-px bg-outline-subtle"></div>
				<Tooltip text="Heading 1" side="bottom">
					<Toolbar.Button
						onmousedown={saveSelection}
						onclick={() => heading(1)}
						aria-label="Heading 1"
						class={btnClass}
					>
						<TextHOneIcon size={16} />
					</Toolbar.Button>
				</Tooltip>
				<Tooltip text="Heading 2" side="bottom">
					<Toolbar.Button
						onmousedown={saveSelection}
						onclick={() => heading(2)}
						aria-label="Heading 2"
						class={btnClass}
					>
						<TextHTwoIcon size={16} />
					</Toolbar.Button>
				</Tooltip>
			</Toolbar.Root>

			{#if saveStatus === 'saving'}
				<p class="save-status text-sm">Saving…</p>
			{:else if saveStatus === 'saved'}
				<Tooltip
					text="All your changes to this document are automatically saved to the bucket."
					side="bottom"
				>
					<p
						class="saved-status text-sm cursor-help underline decoration-dotted underline-offset-2"
					>
						Saved to Bucket
					</p>
				</Tooltip>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<button
				onclick={() => (showCheatsheet = !showCheatsheet)}
				aria-label="Markdown Cheatsheet"
				aria-pressed={showCheatsheet}
				class="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-sm font-medium transition-all active:scale-95 cursor-pointer {showCheatsheet
					? 'bg-surface-container-high text-on-surface'
					: 'text-on-surface-subtle hover:bg-surface-container-high hover:text-on-surface'}"
			>
				<BookOpenIcon size={15} />
				Markdown Cheatsheet
			</button>

			<button
				onclick={() => (previewing = !previewing)}
				aria-label={previewing ? 'Edit' : 'Preview'}
				aria-pressed={previewing}
				class="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-sm font-medium transition-all active:scale-95 cursor-pointer {previewing
					? 'bg-primary text-on-primary'
					: 'text-on-surface-subtle hover:bg-surface-container-high hover:text-on-surface'}"
			>
				{#if previewing}
					<EyeSlashIcon size={15} />
				{:else}
					<EyeIcon size={15} />
				{/if}
				Preview
			</button>
		</div>
	</div>

	{#if showCheatsheet}
		<div
			class="rounded-xl border border-outline-subtle bg-surface-container px-5 py-4 text-sm flex flex-col gap-4"
		>
			<div class="flex items-start justify-between gap-4">
				<div class="flex flex-col gap-1">
					<p class="font-medium text-on-surface">What is Markdown?</p>
					<p class="text-on-surface-subtle leading-relaxed">
						Markdown is a simple way to format text using plain characters. You type symbols
						alongside your words — like putting <code class="cheat-inline-code">**</code> around
						text to make it <strong>bold</strong> — and the app turns them into styled output automatically.
						The preview pane on the right shows you what readers will see.
					</p>
				</div>
				<button
					onclick={() => (showCheatsheet = false)}
					aria-label="Close cheatsheet"
					class="shrink-0 inline-flex items-center justify-center size-7 rounded-sm text-on-surface-subtle hover:bg-surface-container-high hover:text-on-surface transition-all cursor-pointer"
				>
					<XIcon size={14} />
				</button>
			</div>

			<div class="h-px bg-outline-subtle"></div>

			<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
				<div class="flex flex-col gap-2">
					<p class="text-xs font-semibold uppercase tracking-wide text-on-surface-subtle">
						Headers
					</p>
					<div class="flex flex-col gap-1.5">
						<div class="cheat-row">
							<code># Title</code>
							<span>Main heading</span>
						</div>
						<div class="cheat-row">
							<code>## Section</code>
							<span>Subheading</span>
						</div>
						<div class="cheat-row">
							<code>### Smaller</code>
							<span>Sub-subheading</span>
						</div>
					</div>
				</div>

				<div class="flex flex-col gap-2">
					<p class="text-xs font-semibold uppercase tracking-wide text-on-surface-subtle">
						Text Formatting
					</p>
					<div class="flex flex-col gap-1.5">
						<div class="cheat-row">
							<code>**bold**</code>
							<span><strong>bold</strong></span>
						</div>
						<div class="cheat-row">
							<code>_italic_</code>
							<span><em>italic</em></span>
						</div>
						<div class="cheat-row">
							<code>++text++</code>
							<span><u>underline</u></span>
						</div>
					</div>
				</div>

				<div class="flex flex-col gap-2">
					<p class="text-xs font-semibold uppercase tracking-wide text-on-surface-subtle">Lists</p>
					<div class="flex flex-col gap-1.5">
						<div class="cheat-row">
							<code>- item</code>
							<span>Bullet list</span>
						</div>
						<div class="cheat-row">
							<code>* item</code>
							<span>Also bullet list</span>
						</div>
						<div class="cheat-row">
							<code>1. item</code>
							<span>Numbered list</span>
						</div>
					</div>
				</div>

				<div class="flex flex-col gap-2">
					<p class="text-xs font-semibold uppercase tracking-wide text-on-surface-subtle">
						Quotes & Code
					</p>
					<div class="flex flex-col gap-1.5">
						<div class="cheat-row">
							<code>&gt; quote</code>
							<span>Block quote</span>
						</div>
						<div class="cheat-row">
							<code>`code`</code>
							<span>Inline code</span>
						</div>
						<div class="cheat-row">
							<code>```</code>
							<span>Code block (fenced)</span>
						</div>
					</div>
				</div>

				<div class="flex flex-col gap-2">
					<p class="text-xs font-semibold uppercase tracking-wide text-on-surface-subtle">
						Keyboard Shortcuts
					</p>
					<div class="flex flex-col gap-1.5">
						<div class="cheat-row">
							<span class="shortcut"
								>{#if isMac}<kbd class="cmd-sym">⌘</kbd>{:else}<kbd>Ctrl</kbd>{/if}<span
									class="shortcut-plus">+</span
								><kbd>B</kbd></span
							>
							<span>Bold</span>
						</div>
						<div class="cheat-row">
							<span class="shortcut"
								>{#if isMac}<kbd class="cmd-sym">⌘</kbd>{:else}<kbd>Ctrl</kbd>{/if}<span
									class="shortcut-plus">+</span
								><kbd>I</kbd></span
							>
							<span>Italic</span>
						</div>
						<div class="cheat-row">
							<span class="shortcut"
								>{#if isMac}<kbd class="cmd-sym">⌘</kbd>{:else}<kbd>Ctrl</kbd>{/if}<span
									class="shortcut-plus">+</span
								><kbd>U</kbd></span
							>
							<span>Underline</span>
						</div>
					</div>
				</div>

				<div class="flex flex-col gap-2">
					<p class="text-xs font-semibold uppercase tracking-wide text-on-surface-subtle">Tips</p>
					<div class="flex flex-col gap-2 text-on-surface-subtle leading-relaxed">
						<p>Leave a blank line between paragraphs to keep them separate.</p>
						<p>Indent a list item with two spaces to nest it inside another list item.</p>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<div
		class="bg-surface-container rounded-sm overflow-hidden relative"
		data-editor-mode={previewing && windowWidth >= 1024 ? 'split' : previewing ? 'preview' : 'edit'}
	>
		{#if browser && carta}
			<CartaEditor
				{carta}
				bind:value={content}
				mode={previewing && windowWidth >= 1024 ? 'split' : 'tabs'}
				disableToolbar
				selectedTab={previewing ? 'preview' : 'write'}
			/>
		{/if}
		{#if previewing}
			<div class="preview-pane-label">
				<Tooltip
					text="A live preview of how your document will appear to readers. Toggle it off using the Preview button in the top-right."
					side="bottom"
				>
					<span
						class="text-xs underline decoration-dotted underline-offset-2 cursor-help"
						style="color: var(--preview-pane-header-text)"
					>
						What is this Preview Pane?
					</span>
				</Tooltip>
			</div>
		{/if}
	</div>
</div>

<style>
	.save-status {
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--on-surface-subtle) 30%, transparent),
			color-mix(in srgb, var(--on-surface-subtle) 70%, transparent),
			color-mix(in srgb, var(--on-surface-subtle) 40%, transparent),
			color-mix(in srgb, var(--on-surface-subtle) 80%, transparent),
			color-mix(in srgb, var(--on-surface-subtle) 25%, transparent),
			color-mix(in srgb, var(--on-surface-subtle) 70%, transparent),
			color-mix(in srgb, var(--on-surface-subtle) 30%, transparent)
		);
		background-size: 300%;
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		animation: shimmer-sweep 8s linear infinite;
	}

	.saved-status {
		color: color-mix(in srgb, var(--on-surface-subtle) 50%, transparent);
	}

	@keyframes shimmer-sweep {
		from {
			background-position: 300%;
		}
		to {
			background-position: 0%;
		}
	}

	:global(.carta-theme__default .mode-split.carta-container::after) {
		top: -0.75rem;
		bottom: -0.75rem;
	}

	:global(.carta-editor),
	:global(.carta-theme__default.carta-editor) {
		min-height: 400px;
		font-size: 1rem;
		border: none;
		border-radius: 0;
		background: transparent;
		padding: 0.75rem 0;
	}

	:global(.carta-input),
	:global(.carta-renderer) {
		min-height: 400px;
		line-height: 1.6;
		padding-left: 0.75rem;
		padding-right: 0.75rem;
		font-family: inherit;
	}

	:global(.carta-theme__default .mode-split .carta-renderer),
	:global([data-editor-mode='preview'] .carta-renderer) {
		padding-top: 2.25rem;
	}

	.preview-pane-label {
		--preview-pane-header-bg: var(--surface-container-highest);
		--preview-pane-header-border: var(--outline-subtle);
		--preview-pane-header-text: var(--on-surface);
		position: absolute;
		top: 0;
		right: 0;
		width: 50%;
		padding: 0.5rem 0.75rem;
		background: var(--preview-pane-header-bg);
		border-bottom: 1px solid var(--preview-pane-header-border);
		pointer-events: none;
		z-index: 1;
	}

	[data-editor-mode='preview'] .preview-pane-label {
		width: 100%;
		left: 0;
	}

	.preview-pane-label :global(*) {
		pointer-events: auto;
	}

	.cheat-row {
		display: flex;
		align-items: baseline;
		gap: 0.625rem;
		color: var(--on-surface-subtle);
	}

	.cheat-row kbd {
		font-family: ui-monospace, monospace;
		font-size: 0.8em;
		background: var(--surface-container-high);
		color: var(--on-surface);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.35rem;
		height: 1.35rem;
		border-radius: 4px;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.cheat-row kbd.cmd-sym {
		font-size: 1em;
	}

	.shortcut {
		display: inline-flex;
		align-items: center;
		gap: 0.05rem;
		flex-shrink: 0;
		white-space: nowrap;
	}

	.shortcut-plus {
		font-size: 0.65em;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: color-mix(in srgb, var(--on-surface-subtle) 50%, transparent);
		padding: 0;
		margin: 0 2px 2px;
	}

	.cheat-row span {
		font-size: 0.8125rem;
	}

	.cheat-inline-code {
		font-family: ui-monospace, monospace;
		font-size: 0.85em;
		background: var(--surface-container-high);
		color: var(--on-surface);
		padding: 0.1em 0.3em;
		border-radius: 3px;
	}

	:global([data-theme='dark']) :global(.carta-theme__default) {
		--border-color: var(--border-color-dark);
		--selection-color: var(--selection-color-dark);
		--focus-outline: var(--focus-outline-dark);
		--hover-color: var(--hover-color-dark);
		--caret-color: var(--caret-color-dark);
		--text-color: var(--text-color-dark);
	}

	:global([data-theme='dark']) :global(.carta-theme__default) :global(button) {
		color: var(--text-color-dark);
	}

	:global([data-theme='dark']) :global(.carta-input) {
		background: transparent;
		color: var(--text-color-dark);
	}

	:global([data-theme='dark']) :global(.carta-renderer) {
		color: var(--text-color-dark);
	}

	:global(.carta-renderer) :global(h1) {
		font-size: 1.375rem;
		font-weight: 400;
		line-height: 1.3;
		margin-top: 1.25rem;
		margin-bottom: 1rem;
		color: var(--on-surface);
	}

	:global(.carta-renderer) :global(h1:first-child),
	:global(.carta-renderer) :global(h2:first-child),
	:global(.carta-renderer) :global(h3:first-child) {
		margin-top: 0;
	}

	:global(.carta-renderer) :global(h1:has(+ h2)),
	:global(.carta-renderer) :global(h1:has(+ h3)),
	:global(.carta-renderer) :global(h2:has(+ h3)),
	:global(.carta-renderer) :global(h2:has(+ h4)),
	:global(.carta-renderer) :global(h3:has(+ h4)),
	:global(.carta-renderer) :global(h3:has(+ h5)),
	:global(.carta-renderer) :global(h4:has(+ h5)),
	:global(.carta-renderer) :global(h4:has(+ h6)),
	:global(.carta-renderer) :global(h5:has(+ h6)) {
		margin-bottom: 0.125rem;
	}

	:global(.carta-renderer) :global(h1 + h2),
	:global(.carta-renderer) :global(h1 + h3),
	:global(.carta-renderer) :global(h2 + h3),
	:global(.carta-renderer) :global(h2 + h4),
	:global(.carta-renderer) :global(h3 + h4),
	:global(.carta-renderer) :global(h3 + h5),
	:global(.carta-renderer) :global(h4 + h5),
	:global(.carta-renderer) :global(h4 + h6),
	:global(.carta-renderer) :global(h5 + h6) {
		margin-top: 0;
	}

	:global(.carta-renderer) :global(h2),
	:global(.carta-renderer) :global(h3),
	:global(.carta-renderer) :global(h4),
	:global(.carta-renderer) :global(h5),
	:global(.carta-renderer) :global(h6) {
		font-size: 1.05rem;
		font-weight: 300;
		line-height: 1.4;
		margin-top: 1rem;
		margin-bottom: 0.75rem;
		color: var(--on-surface-subtle);
	}

	:global(.carta-renderer) :global(p) {
		margin-bottom: 0.75rem;
	}

	:global(.carta-renderer) :global(strong) {
		font-weight: 600;
	}

	:global(.carta-renderer) :global(u),
	:global(.carta-renderer) :global(ins) {
		text-decoration: underline;
		text-decoration-skip-ink: auto;
	}

	:global(.carta-renderer) :global(code) {
		font-family: ui-monospace, monospace;
		font-size: 0.875em;
		background: var(--surface-container-high);
		color: var(--on-surface);
		padding: 0.15em 0.35em;
		border-radius: 4px;
	}

	:global(.carta-renderer) :global(pre) {
		background: var(--surface-container-high);
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 0.75rem;
		overflow-x: auto;
	}

	:global(.carta-renderer) :global(pre code) {
		background: none;
		padding: 0;
		border-radius: 0;
		font-size: 0.875rem;
	}

	:global(.carta-renderer) :global(blockquote) {
		border-left: 3px solid var(--outline);
		padding-left: 1rem;
		margin-left: 0;
		margin-bottom: 0.75rem;
		color: var(--on-surface-subtle);
		font-style: italic;
	}

	:global(.carta-renderer) :global(ul) {
		list-style-type: disc;
		padding-left: 1.5rem;
		margin-bottom: 0.75rem;
	}

	:global(.carta-renderer) :global(ol) {
		list-style-type: decimal;
		padding-left: 1.5rem;
		margin-bottom: 0.75rem;
	}

	:global(.carta-renderer) :global(li) {
		margin-bottom: 0.25rem;
	}

	:global(.carta-renderer) :global(ul ul),
	:global(.carta-renderer) :global(ol ol),
	:global(.carta-renderer) :global(ul ol),
	:global(.carta-renderer) :global(ol ul) {
		margin-bottom: 0;
	}

	:global([data-theme='dark']) :global(.shiki),
	:global([data-theme='dark']) :global(.shiki span) {
		color: var(--shiki-dark) !important;
	}
</style>
