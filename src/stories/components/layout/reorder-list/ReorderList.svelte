<script lang="ts">
	import { ReorderGroup, ReorderItem, useMotionValue } from 'motion-sv';
	import type { MotionValue } from 'motion-dom';
	import type { Snippet } from 'svelte';

	/**
	 * A row or column of items that can be dragged into a new order, by mouse or
	 * by touch, with the other items sliding out of the way. This is the one
	 * place reordering is built, so every reorderable list moves the same way.
	 */
	interface Props {
		/** The item ids in their saved order. */
		ids: string[];
		/**
		 * Called once when a drag ends with a different order. If it rejects, the
		 * items go back to `ids`. Without it the items cannot be dragged.
		 */
		onReorder?: (ids: string[]) => void | Promise<void>;
		/** Which way the items lay out. @default 'x' */
		axis?: 'x' | 'y';
		/** Tag of the list. @default 'ul' */
		as?: 'ul' | 'ol' | 'div';
		/** Tag of each item. @default 'li' */
		itemAs?: 'li' | 'div';
		class?: string;
		/** Extra classes for an item; `dragging` is true while it is held. */
		itemClass?: (id: string, dragging: boolean) => string;
		/** Extra attributes for an item, such as `role` or `aria-selected`. */
		itemProps?: (id: string) => Record<string, unknown>;
		/** The content of one item. */
		item: Snippet<[id: string, dragging: boolean]>;
		[key: string]: unknown;
	}

	const {
		ids,
		onReorder,
		axis = 'x',
		as = 'ul',
		itemAs = 'li',
		class: className = '',
		itemClass,
		itemProps,
		item,
		...rest
	}: Props = $props();

	// The order shown while dragging; the saved order from `ids` replaces it
	// whenever that changes.
	let order = $derived([...ids]);

	// The group does not hand back its element through `bind:ref`, so it is found
	// as the only child of a wrapper that has no box of its own.
	let wrapper = $state<HTMLElement | null>(null);
	const groupEl = $derived((wrapper?.firstElementChild as HTMLElement | null) ?? null);

	// Items cannot be dragged out of the list's own box, so a tab stops at its
	// neighbours instead of leaving the page.
	//
	// This is done by hand because motion-sv's own `dragConstraints` does not
	// work here: given the group element, the item still sees `dragConstraints`
	// as `false` when a drag starts (motion-sv 0.2.2, checked with the group
	// element passed at first render and after mount). Replace this with
	// `dragConstraints={groupEl}` once that is fixed upstream; the spec
	// "does not let an item be dragged past the start of the list" covers it.
	let itemEls = $state<Record<string, HTMLElement | undefined>>({});
	const offsets = new Map<string, MotionValue<number>>();

	function offsetFor(id: string): MotionValue<number> {
		let offset = offsets.get(id);
		if (!offset) {
			offset = useMotionValue(0);
			offsets.set(id, offset);
		}
		return offset;
	}

	// Runs after each drag move. Clamping inside a change listener does not work:
	// the renderer's listener would still be handed the unclamped value.
	function keepInside(id: string) {
		const offset = offsetFor(id);
		const latest = offset.get();
		const el = itemEls[id];
		const group = groupEl;
		if (!el || !group) return;

		const horizontal = axis === 'x';
		const position = (node: HTMLElement) => (horizontal ? node.offsetLeft : node.offsetTop);
		const size = (node: HTMLElement) => (horizontal ? node.offsetWidth : node.offsetHeight);

		// Layout positions ignore transforms, so they are where the item rests.
		const start = el.offsetParent === group ? position(el) : position(el) - position(group);
		const room = size(group) - size(el);
		if (room < 0) return;

		const min = -start;
		const max = room - start;
		const clamped = Math.min(Math.max(latest, min), max);
		if (clamped !== latest) offset.set(clamped);
	}

	// A drag that ends over a link or button still produces a click, which would
	// follow the link. Swallow the one that comes straight after a drag.
	let justDragged = false;

	function swallowClickAfterDrag(event: MouseEvent) {
		if (!justDragged) return;
		event.preventDefault();
		event.stopPropagation();
	}

	async function finishDrag() {
		// The click comes right after the release, so keep swallowing for a moment.
		setTimeout(() => (justDragged = false), 100);

		if (!onReorder || order.join() === ids.join()) return;
		try {
			await onReorder([...order]);
		} catch {
			// The caller says what went wrong; show the saved order again.
			order = [...ids];
		}
	}
</script>

<div bind:this={wrapper} class="contents">
	<ReorderGroup
		{as}
		{axis}
		values={order}
		onReorder={(next: string[]) => (order = next)}
		class={className}
		{...rest}
	>
		{#each order as id (id)}
			<ReorderItem
				as={itemAs}
				value={id}
				drag={onReorder ? axis : false}
				style={{ [axis]: offsetFor(id) }}
				bind:ref={itemEls[id]}
				dragElastic={0}
				onDrag={() => {
					justDragged = true;
					keepInside(id);
				}}
				onDragEnd={finishDrag}
				onclickcapture={swallowClickAfterDrag}
				class={itemClass?.(id, false) ?? ''}
				{...itemProps?.(id) ?? {}}
			>
				{#snippet children(dragging: boolean)}
					{@render item(id, dragging)}
				{/snippet}
			</ReorderItem>
		{/each}
	</ReorderGroup>
</div>
