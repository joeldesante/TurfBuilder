<script lang="ts">
	import { flip } from 'svelte/animate';
	import { AlertDialog } from 'bits-ui';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import XIcon from 'phosphor-svelte/lib/X';
	import Button from '$components/actions/button/Button.svelte';

	export interface Tab {
		id: string;
		label: string;
	}

	interface Props {
		tabs: Tab[];
		activeId: string;
		onSelect: (id: string) => void;
		onAdd: () => void;
		onClose: (id: string) => void;
		onReorder: (tabs: Tab[]) => void;
	}

	let { tabs, activeId, onSelect, onAdd, onClose, onReorder }: Props = $props();

	let pendingCloseId = $state<string | null>(null);
	let pendingCloseTab = $derived(tabs.find((tab) => tab.id === pendingCloseId) ?? null);

	const GAP_PX = 4;

	let containerEl: HTMLElement | undefined = $state();
	let tabEls: Record<string, HTMLElement> = {};
	let widths: Record<string, number> = {};

	function registerTabEl(node: HTMLElement, id: string) {
		tabEls[id] = node;
		return {
			destroy() {
				delete tabEls[id];
			}
		};
	}

	interface DragState {
		id: string;
		startClientX: number;
		originLeft: number;
		offsetX: number;
		width: number;
	}

	const DRAG_THRESHOLD_PX = 4;

	// Captured on pointerdown but not yet promoted to `dragging` until the
	// pointer moves past DRAG_THRESHOLD_PX, so a stationary press doesn't
	// show drag visuals for what's really just a click.
	let pending = $state<DragState | null>(null);
	let dragging = $state<DragState | null>(null);
	let draggedTab = $derived(tabs.find((tab) => tab.id === dragging?.id) ?? null);

	function leftOf(id: string): number {
		let cumulative = 0;
		for (const tab of tabs) {
			if (tab.id === id) break;
			cumulative += (widths[tab.id] ?? 0) + GAP_PX;
		}
		return cumulative;
	}

	function handlePointerDown(event: PointerEvent, id: string) {
		if (event.button !== 0 || !containerEl) return;

		onSelect(id);

		for (const tab of tabs) {
			widths[tab.id] = tabEls[tab.id]?.offsetWidth ?? 0;
		}

		pending = {
			id,
			startClientX: event.clientX,
			originLeft: leftOf(id),
			offsetX: 0,
			width: widths[id] ?? 0
		};
	}

	function handlePointerMove(event: PointerEvent) {
		if (!dragging && pending) {
			if (Math.abs(event.clientX - pending.startClientX) >= DRAG_THRESHOLD_PX) {
				dragging = pending;
			} else {
				return;
			}
		}
		if (!dragging) return;

		const offsetX = event.clientX - dragging.startClientX;
		dragging = { ...dragging, offsetX };

		const draggedCenter = dragging.originLeft + dragging.width / 2 + offsetX;

		const others = tabs.filter((tab) => tab.id !== dragging!.id);
		let cumulative = 0;
		let targetIndex = others.length;
		for (let i = 0; i < others.length; i++) {
			const width = widths[others[i].id] ?? 0;
			if (draggedCenter < cumulative + width / 2) {
				targetIndex = i;
				break;
			}
			cumulative += width + GAP_PX;
		}

		const fromIndex = tabs.findIndex((tab) => tab.id === dragging!.id);
		if (fromIndex !== targetIndex) {
			const reordered = [...tabs];
			const [moved] = reordered.splice(fromIndex, 1);
			reordered.splice(targetIndex, 0, moved);
			onReorder(reordered);
		}
	}

	function handlePointerUp() {
		pending = null;
		dragging = null;
	}

	function requestClose(id: string) {
		pendingCloseId = id;
	}

	function confirmClose() {
		if (pendingCloseId) onClose(pendingCloseId);
		pendingCloseId = null;
	}
</script>

<svelte:window onpointermove={handlePointerMove} onpointerup={handlePointerUp} />

{#snippet tabContent(tab: Tab)}
	<span>{tab.label}</span>
	<button
		type="button"
		aria-label={`Close ${tab.label}`}
		class="rounded p-0.5 hover:bg-surface-container-highest [&>svg]:size-3.5"
		onclick={(e) => {
			e.stopPropagation();
			requestClose(tab.id);
		}}
	>
		<XIcon />
	</button>
{/snippet}

<div
	bind:this={containerEl}
	class="relative flex items-end border-b gap-1 border-outline-subtle bg-surface-container p-1 overflow-y-scroll no-scrollbar"
	role="tablist"
>
	{#each tabs as tab (tab.id)}
		<div
			use:registerTabEl={tab.id}
			role="tab"
			tabindex="0"
			aria-selected={tab.id === activeId}
			onpointerdown={(e) => handlePointerDown(e, tab.id)}
			onkeydown={(e) => e.key === 'Enter' && onSelect(tab.id)}
			animate:flip={{ duration: 200 }}
			class={[
				'flex items-center justify-between gap-2 h-8 min-w-32 px-2 rounded-md border cursor-pointer select-none text-sm transition-colors',
				tab.id === activeId
					? 'bg-surface text-on-surface font-semibold border-outline-subtle shadow-sm relative'
					: 'text-on-surface-variant border-transparent hover:bg-surface-container-highest hover:text-on-surface',
				dragging?.id === tab.id ? 'invisible' : ''
			].join(' ')}
		>
			{@render tabContent(tab)}
		</div>
	{/each}

	<Button variant="ghost" size="sm" iconOnly aria-label="New tab" class="mx-1" onclick={onAdd}>
		<PlusIcon />
	</Button>

	{#if dragging && draggedTab}
		<div
			aria-hidden="true"
			class={[
				'absolute bottom-1 flex flex items-center justify-between gap-2 h-8 min-w-32 px-2 rounded-md border cursor-pointer select-none text-sm transition-colors z-20',
				draggedTab.id === activeId
					? 'bg-surface text-on-surface font-semibold border-outline-subtle'
					: 'bg-surface-container-high text-on-surface-variant border-transparent'
			].join(' ')}
			style={`left: ${dragging.originLeft + dragging.offsetX}px; width: ${dragging.width}px;`}
		>
			{@render tabContent(draggedTab)}
		</div>
	{/if}
</div>

<AlertDialog.Root
	open={pendingCloseId !== null}
	onOpenChange={(open) => !open && (pendingCloseId = null)}
>
	<AlertDialog.Portal>
		<AlertDialog.Overlay class="fixed inset-0 z-50 bg-scrim/40" />
		<AlertDialog.Content
			class="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-lg"
		>
			<AlertDialog.Title class="text-lg font-semibold text-on-surface">
				Close tab?
			</AlertDialog.Title>
			<AlertDialog.Description class="mt-2 text-sm text-on-surface-variant">
				Are you sure you want to close "{pendingCloseTab?.label}"?
			</AlertDialog.Description>
			<div class="mt-6 flex justify-end gap-2">
				<AlertDialog.Cancel>
					{#snippet child({ props })}
						<Button {...props} variant="outline">Cancel</Button>
					{/snippet}
				</AlertDialog.Cancel>
				<AlertDialog.Action>
					{#snippet child({ props })}
						<Button {...props} variant="destructive" onclick={confirmClose}>Close tab</Button>
					{/snippet}
				</AlertDialog.Action>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
