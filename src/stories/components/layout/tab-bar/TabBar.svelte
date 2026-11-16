<script lang="ts">
	import { AlertDialog } from 'bits-ui';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import XIcon from 'phosphor-svelte/lib/X';
	import Button from '$components/actions/button/Button.svelte';
	import ReorderList from '$components/layout/reorder-list/ReorderList.svelte';

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

	const tabIds = $derived(tabs.map((tab) => tab.id));
	const labelOf = (id: string) => tabs.find((tab) => tab.id === id)?.label ?? '';

	function reorder(ids: string[]) {
		onReorder(
			ids.map((id) => tabs.find((tab) => tab.id === id)).filter((tab) => tab !== undefined)
		);
	}

	function requestClose(id: string) {
		pendingCloseId = id;
	}

	function confirmClose() {
		if (pendingCloseId) onClose(pendingCloseId);
		pendingCloseId = null;
	}
</script>

<div
	class="relative flex items-end border-b gap-1 border-outline-subtle bg-surface-container p-1 overflow-x-auto no-scrollbar"
>
	<ReorderList
		ids={tabIds}
		onReorder={reorder}
		as="div"
		itemAs="div"
		class="flex items-end gap-1"
		role="tablist"
		itemProps={() => ({ role: 'presentation' })}
		itemClass={() => 'flex'}
	>
		{#snippet item(id)}
			<!-- The tab itself is rendered here, not set as props on the reorder item: the
			     item's own attributes do not update when `activeId` changes. -->
			<div
				role="tab"
				tabindex="0"
				aria-selected={id === activeId}
				onclick={() => onSelect(id)}
				onkeydown={(e) => e.key === 'Enter' && onSelect(id)}
				class={[
					'flex items-center justify-between gap-2 h-8 min-w-32 px-2 rounded-md border cursor-pointer select-none text-sm transition-colors',
					id === activeId
						? 'bg-surface text-on-surface font-semibold border-outline-subtle shadow-sm relative'
						: 'text-on-surface-variant border-transparent hover:bg-surface-container-highest hover:text-on-surface'
				].join(' ')}
			>
				<span>{labelOf(id)}</span>
				<button
					type="button"
					aria-label={`Close ${labelOf(id)}`}
					class="rounded p-0.5 hover:bg-surface-container-highest [&>svg]:size-3.5"
					onclick={(e) => {
						e.stopPropagation();
						requestClose(id);
					}}
				>
					<XIcon />
				</button>
			</div>
		{/snippet}
	</ReorderList>

	<Button variant="ghost" size="sm" iconOnly aria-label="New tab" class="mx-1" onclick={onAdd}>
		<PlusIcon />
	</Button>
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
