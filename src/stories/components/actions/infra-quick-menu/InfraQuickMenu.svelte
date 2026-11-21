<script lang="ts">
	import { onMount } from 'svelte';
	import { Popover } from 'bits-ui';
	import WrenchIcon from 'phosphor-svelte/lib/Wrench';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlass';
	import BuildingsIcon from 'phosphor-svelte/lib/Buildings';
	import { INFRA_NAV_ICONS } from '$components/layout/fragments/infra-nav/icons';
	import type { InfraNavGroup } from '$lib/shared/utils/infra-nav';

	interface Props {
		/** The infra pages and external tools the admin can open. */
		groups: InfraNavGroup[];
		/** The organization being viewed, for a shortcut to its infra page. */
		currentOrg?: { id: string; name: string } | null;
		open?: boolean;
		/**
		 * Phones only: sit to the left of a floating action button in the bottom right corner
		 * (the organization picker's +) instead of underneath it.
		 */
		besideFab?: boolean;
	}

	let { groups, currentOrg = null, open = $bindable(false), besideFab = false }: Props = $props();

	const STORAGE_KEY = 'infra-quick-menu-position';
	/** Pixels the pointer must travel before a press counts as a drag instead of a click. */
	const DRAG_THRESHOLD = 4;

	let wrapper: HTMLDivElement;
	/** Where the admin dragged the button (top left corner, px). Null keeps it in its corner. */
	let position = $state<{ x: number; y: number } | null>(null);
	let drag: { startX: number; startY: number; originX: number; originY: number; moved: boolean } | null =
		null;
	let justDragged = false;

	function clamp(pos: { x: number; y: number }) {
		const width = wrapper?.offsetWidth ?? 44;
		const height = wrapper?.offsetHeight ?? 44;
		return {
			x: Math.min(Math.max(0, pos.x), Math.max(0, window.innerWidth - width)),
			y: Math.min(Math.max(0, pos.y), Math.max(0, window.innerHeight - height))
		};
	}

	function save() {
		try {
			if (position) localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
		} catch {
			// Storage can be blocked; the button just resets next visit.
		}
	}

	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
			if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
				position = clamp(saved);
			}
		} catch {
			// Nothing saved or unreadable: stay in the corner.
		}
	});

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0) return;
		const rect = wrapper.getBoundingClientRect();
		drag = {
			startX: event.clientX,
			startY: event.clientY,
			originX: rect.left,
			originY: rect.top,
			moved: false
		};
	}

	function onpointermove(event: PointerEvent) {
		if (!drag) return;
		const dx = event.clientX - drag.startX;
		const dy = event.clientY - drag.startY;
		if (!drag.moved) {
			if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
			drag.moved = true;
			open = false;
			wrapper.setPointerCapture(event.pointerId);
		}
		position = clamp({ x: drag.originX + dx, y: drag.originY + dy });
	}

	function onpointerup() {
		if (drag?.moved) {
			justDragged = true;
			// The click that follows the release must not toggle the menu.
			setTimeout(() => (justDragged = false), 0);
			save();
		}
		drag = null;
	}

	function onclickcapture(event: MouseEvent) {
		if (justDragged) {
			event.stopPropagation();
			event.preventDefault();
		}
	}

	function onresize() {
		if (position) position = clamp(position);
	}

	let query = $state('');
	const trimmed = $derived(query.trim());

	function onkeydown(event: KeyboardEvent) {
		// Alt+I, matched by code so it works where Alt changes the typed character.
		if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyI') {
			event.preventDefault();
			open = !open;
		}
	}

	function close() {
		open = false;
		query = '';
	}

	const linkClass =
		'flex items-center gap-2 h-9 px-3 rounded-md text-sm text-on-surface no-underline outline-none hover:bg-surface-container-high focus-visible:bg-surface-container-high [&>svg]:size-4 [&>svg]:shrink-0';
</script>

<svelte:window {onkeydown} {onresize} />

<div
	bind:this={wrapper}
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	onpointercancel={onpointerup}
	{onclickcapture}
	class={[
		'fixed z-40 touch-none print:hidden',
		// 1rem gutter + the 3.5rem button + 0.75rem gap; bottom lines the centres up.
		besideFab && !position && 'max-md:right-[calc(5.25rem+env(safe-area-inset-right))]! max-md:bottom-[calc(1.875rem+env(safe-area-inset-bottom))]!'
	]}
	style={position
		? `left: ${position.x}px; top: ${position.y}px;`
		: 'right: calc(1rem + env(safe-area-inset-right)); bottom: calc(1rem + env(safe-area-inset-bottom));'}
>
	<Popover.Root bind:open onOpenChange={(next) => !next && (query = '')}>
		<Popover.Trigger
			aria-label="Infrastructure menu"
			title="Infrastructure menu (Alt+I)"
			class="flex size-11 items-center justify-center rounded-full border border-outline bg-inverse-surface text-inverse-on-surface shadow-lg outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary"
		>
			<WrenchIcon class="size-5" weight="bold" />
		</Popover.Trigger>
		<Popover.Portal>
			<Popover.Content
				side="top"
				align="end"
				sideOffset={8}
				class="z-50 w-72 max-h-[min(36rem,80dvh)] overflow-y-auto rounded-xl border border-outline bg-surface-container-low p-2 shadow-xl"
			>
				<form
					role="search"
					class="px-1 pb-2"
					onsubmit={(event) => {
						event.preventDefault();
					}}
				>
					<label class="flex items-center gap-2 h-9 px-2 rounded-md border border-outline bg-surface text-sm focus-within:ring-2 focus-within:ring-primary">
						<MagnifyingGlassIcon class="size-4 shrink-0 text-on-surface-subtle" />
						<span class="sr-only">Find a user or organization</span>
						<input
							bind:value={query}
							placeholder="Find a user or organization"
							class="w-full bg-transparent outline-none placeholder:text-on-surface-subtle"
						/>
					</label>
					{#if trimmed}
						<div class="mt-1 flex flex-col">
							<a class={linkClass} href={`/infra/users?q=${encodeURIComponent(trimmed)}`} onclick={close}>
								<INFRA_NAV_ICONS.users />
								<span class="truncate">Users matching "{trimmed}"</span>
							</a>
							<a class={linkClass} href={`/infra/orgs?q=${encodeURIComponent(trimmed)}`} onclick={close}>
								<INFRA_NAV_ICONS.organizations />
								<span class="truncate">Organizations matching "{trimmed}"</span>
							</a>
						</div>
					{/if}
				</form>

				{#if currentOrg}
					<div class="border-t border-outline-subtle px-1 py-2">
						<a class={linkClass} href={`/infra/orgs/${currentOrg.id}`} onclick={close}>
							<BuildingsIcon />
							<span class="truncate">Open {currentOrg.name} in infra</span>
						</a>
					</div>
				{/if}

				{#each groups as group (group.label ?? '')}
					<div class="border-t border-outline-subtle px-1 py-2">
						{#if group.label}
							<p class="px-3 pb-1 text-xs font-medium text-on-surface-subtle">{group.label}</p>
						{/if}
						{#each group.links as link (link.href)}
							{@const Icon = INFRA_NAV_ICONS[link.icon]}
							{#if link.external}
								<a class={linkClass} href={link.href} target="_blank" rel="noopener noreferrer" onclick={close}>
									<Icon />
									<span class="truncate">{link.label}</span>
									<span class="sr-only">(opens in a new tab)</span>
								</a>
							{:else}
								<a class={linkClass} href={link.href} onclick={close}>
									<Icon />
									<span class="truncate">{link.label}</span>
								</a>
							{/if}
						{/each}
					</div>
				{/each}
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
</div>
