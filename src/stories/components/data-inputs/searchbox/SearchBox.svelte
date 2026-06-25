<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import TextInput from '../text-input/TextInput.svelte';
	import Spinner from '$components/feedback/spinner/Spinner.svelte';
	import type { SidebarNavEntry } from '$components/layout/fragments/sidebar/types';

	interface SearchResult {
		id: string;
		title: string;
		subtitle: string;
		href: string;
	}

	interface Results {
		surveys: SearchResult[];
		turfs: SearchResult[];
		members: SearchResult[];
		locations: SearchResult[];
		people: SearchResult[];
	}

	interface HistoryItem {
		title: string;
		subtitle: string;
		href: string;
	}

	interface NavPage {
		label: string;
		subtitle: string;
		href: string;
	}

	interface Props {
		close?: () => void;
		nav?: SidebarNavEntry[];
		open?: boolean;
	}

	let { close, nav = [], open = false }: Props = $props();

	$effect(() => {
		if (open) query = '';
	});

	function flattenNav(entries: SidebarNavEntry[]): NavPage[] {
		const pages: NavPage[] = [];
		for (const entry of entries) {
			if (entry.kind === 'item') {
				pages.push({ label: entry.item.label, subtitle: '', href: entry.item.href });
			} else if (entry.kind === 'section') {
				for (const item of entry.section.items) {
					if ('href' in item) {
						pages.push({ label: item.label, subtitle: entry.section.label, href: item.href });
					} else {
						for (const sub of item.items) {
							pages.push({
								label: sub.label,
								subtitle: `${entry.section.label} › ${item.label}`,
								href: sub.href
							});
						}
					}
				}
			}
		}
		return pages;
	}

	function fuzzyMatch(lowercasedQuery: string, target: string): boolean {
		const t = target.toLowerCase();
		let qi = 0;
		for (let i = 0; i < t.length && qi < lowercasedQuery.length; i++) {
			if (t[i] === lowercasedQuery[qi]) qi++;
		}
		return qi === lowercasedQuery.length;
	}

	const allNavPages = $derived(flattenNav(nav));

	let query = $state('');
	let results = $state<Results | null>(null);
	let loading = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout>;

	const orgSlug = $derived(page.params.org_slug ?? page.url.pathname.match(/\/o\/([^/]+)/)?.[1]);
	const orgName = $derived((page.data as { organization?: { name: string } }).organization?.name);

	const historyKey = $derived(orgSlug ? `search_history:${orgSlug}` : null);

	let history = $state<HistoryItem[]>([]);

	$effect(() => {
		if (!historyKey) return;
		try {
			history = JSON.parse(localStorage.getItem(historyKey) ?? '[]');
		} catch {
			history = [];
		}
	});

	function saveToHistory(item: HistoryItem) {
		if (!historyKey) return;
		const next = [item, ...history.filter((h) => h.href !== item.href)].slice(0, 5);
		history = next;
		localStorage.setItem(historyKey, JSON.stringify(next));
	}

	function clearHistory() {
		if (!historyKey) return;
		history = [];
		localStorage.removeItem(historyKey);
	}

	$effect(() => {
		clearTimeout(debounceTimer);
		const q = query;
		if (!orgSlug || q.length < 2) {
			results = null;
			return;
		}
		debounceTimer = setTimeout(async () => {
			loading = true;
			const res = await fetch(`/o/${orgSlug}/s/api/search?q=${encodeURIComponent(q)}`);
			if (res.ok) results = await res.json();
			loading = false;
		}, 300);
		return () => clearTimeout(debounceTimer);
	});

	const sections: { key: keyof Results; label: string }[] = [
		{ key: 'people', label: 'People' },
		{ key: 'surveys', label: 'Surveys' },
		{ key: 'turfs', label: 'Turfs' },
		{ key: 'members', label: 'Members' },
		{ key: 'locations', label: 'Locations' }
	];

	const hasResults = $derived(results !== null && sections.some((s) => results![s.key].length > 0));

	const navResults = $derived.by(() => {
		if (query.length < 1) return [];
		const q = query.toLowerCase();
		return allNavPages
			.filter((p) => fuzzyMatch(q, p.label) || fuzzyMatch(q, p.subtitle))
			.slice(0, 6);
	});

	const showResultsPanel = $derived(
		query.length >= 1 && (navResults.length > 0 || results !== null)
	);

	const flatItems = $derived.by<HistoryItem[]>(() => {
		if (showResultsPanel) {
			const items: HistoryItem[] = navResults.map((p) => ({
				title: p.label,
				subtitle: p.subtitle,
				href: p.href
			}));
			if (hasResults) {
				for (const s of sections) {
					for (const r of results![s.key]) items.push(r);
				}
			}
			return items;
		}
		if (!query && history.length > 0) return [...history];
		return [];
	});

	// Offset of each data section within flatItems (nav results occupy the leading slots).
	const dataSectionOffsets = $derived.by(() => {
		const offsets = new Map<keyof Results, number>();
		let offset = navResults.length;
		for (const s of sections) {
			offsets.set(s.key, offset);
			offset += results?.[s.key]?.length ?? 0;
		}
		return offsets;
	});

	let selectedIndex = $state(-1);

	// Reset selection whenever the visible item list changes.
	$effect(() => {
		flatItems;
		selectedIndex = -1;
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex =
				flatItems.length === 0 ? -1 : selectedIndex < flatItems.length - 1 ? selectedIndex + 1 : 0;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex =
				flatItems.length === 0 ? -1 : selectedIndex > 0 ? selectedIndex - 1 : flatItems.length - 1;
		} else if (e.key === 'Enter') {
			if (selectedIndex >= 0 && selectedIndex < flatItems.length) {
				e.preventDefault();
				select(flatItems[selectedIndex]);
			}
		}
	}

	function itemClass(globalIndex: number): string {
		return [
			'w-full text-left px-3 py-2 flex flex-col gap-0.5',
			globalIndex === selectedIndex
				? 'bg-primary-container/50 text-on-primary-container'
				: 'hover:bg-surface-subtle'
		].join(' ');
	}

	function select(item: HistoryItem) {
		saveToHistory(item);
		close?.();
		goto(item.href);
	}
</script>

<div>
	<div class="relative">
		<TextInput
			type="search"
			placeholder="Search..."
			bind:value={query}
			class="shadow-lg"
			autofocus
			onkeydown={handleKeydown}
		/>
		{#if loading}
			<div
				class="absolute right-3 inset-y-0 flex items-center pointer-events-none text-on-surface-subtle"
			>
				<Spinner size={16} />
			</div>
		{/if}
	</div>
	{#if orgName}
		<span
			class="inline-block mt-2 px-2 py-0.5 rounded-sm-full bg-gray-300 text-gray-800 text-xs font-medium"
			>Searching in {orgName}</span
		>
	{/if}
</div>

{#if showResultsPanel}
	<div class="bg-surface rounded-sm border shadow mt-2 overflow-y-auto max-h-[min(400px,50vh)]">
		{#if navResults.length > 0}
			<div>
				<p
					class="text-xs font-semibold text-on-surface-subtle uppercase tracking-wide px-3 pt-3 pb-1"
				>
					Go to
				</p>
				{#each navResults as navPage, i}
					<button
						class={itemClass(i)}
						onclick={() =>
							select({ title: navPage.label, subtitle: navPage.subtitle, href: navPage.href })}
					>
						<span class="text-sm font-medium">{navPage.label}</span>
						{#if navPage.subtitle}
							<span class="text-xs text-on-surface-subtle">{navPage.subtitle}</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
		{#if hasResults}
			{#each sections as section}
				{#if results![section.key].length > 0}
					<div>
						<p
							class="text-xs font-semibold text-on-surface-subtle uppercase tracking-wide px-3 pt-3 pb-1"
						>
							{section.label}
						</p>
						{#each results![section.key] as result, ri}
							<button
								class={itemClass((dataSectionOffsets.get(section.key) ?? 0) + ri)}
								onclick={() => select(result)}
							>
								<span class="text-sm font-medium">{result.title}</span>
								{#if result.subtitle}
									<span class="text-xs text-on-surface-subtle">{result.subtitle}</span>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			{/each}
		{:else if results !== null}
			<p class="text-sm text-on-surface-subtle px-3 py-4">No results for "{query}"</p>
		{/if}
	</div>
{:else if history.length > 0 && !query}
	<div class="bg-surface rounded-sm border shadow mt-2 overflow-y-auto max-h-[min(400px,50vh)]">
		<div class="flex items-center justify-between px-3 pt-3 pb-1">
			<p class="text-xs font-semibold text-on-surface-subtle uppercase tracking-wide">Recent</p>
			<button class="text-xs text-on-surface-subtle hover:text-on-surface" onclick={clearHistory}>
				Clear
			</button>
		</div>
		{#each history as item, i}
			<button class={itemClass(i)} onclick={() => select(item)}>
				<span class="text-sm font-medium">{item.title}</span>
				{#if item.subtitle}
					<span class="text-xs text-on-surface-subtle">{item.subtitle}</span>
				{/if}
			</button>
		{/each}
	</div>
{/if}
