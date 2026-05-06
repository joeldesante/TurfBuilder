<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import TextInput from '../text-input/TextInput.svelte';
	import Spinner from '$components/feedback/spinner/Spinner.svelte';

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
	}

	interface HistoryItem {
		title: string;
		subtitle: string;
		href: string;
	}

	interface Props {
		close?: () => void;
	}

	let { close }: Props = $props();

	let query = $state('');
	let results = $state<Results | null>(null);
	let loading = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout>;

	const orgSlug = $derived(
		page.params.org_slug ?? page.url.pathname.match(/\/o\/([^/]+)/)?.[1]
	);
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
		const next = [item, ...history.filter(h => h.href !== item.href)].slice(0, 5);
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
		{ key: 'surveys', label: 'Surveys' },
		{ key: 'turfs', label: 'Turfs' },
		{ key: 'members', label: 'Members' },
		{ key: 'locations', label: 'Locations' },
	];

	const hasResults = $derived(
		results !== null && sections.some(s => results![s.key].length > 0)
	);

	function select(item: HistoryItem) {
		saveToHistory(item);
		close?.();
		goto(item.href);
	}
</script>

<div>
	<div class="relative">
		<TextInput type="search" placeholder="Search..." bind:value={query} class="shadow-lg" />
		{#if loading}
			<div class="absolute right-3 inset-y-0 flex items-center pointer-events-none text-on-surface-subtle">
				<Spinner size={16} />
			</div>
		{/if}
	</div>
	{#if orgName}
		<p class="text-xs text-white/70 mt-2 px-1">Searching in {orgName}</p>
	{/if}
</div>

{#if results !== null}
	<div class="bg-surface rounded-lg border shadow mt-2 overflow-hidden">
		{#if hasResults}
			{#each sections as section}
				{#if results[section.key].length > 0}
					<div>
						<p class="text-xs font-semibold text-on-surface-subtle uppercase tracking-wide px-3 pt-3 pb-1">
							{section.label}
						</p>
						{#each results[section.key] as result}
							<button
								class="w-full text-left px-3 py-2 hover:bg-surface-subtle flex flex-col gap-0.5"
								onclick={() => select(result)}
							>
								<span class="text-sm font-medium text-on-surface">{result.title}</span>
								{#if result.subtitle}
									<span class="text-xs text-on-surface-subtle">{result.subtitle}</span>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			{/each}
		{:else}
			<p class="text-sm text-on-surface-subtle px-3 py-4">No results for "{query}"</p>
		{/if}
	</div>
{:else if history.length > 0 && !query}
	<div class="bg-surface rounded-lg border shadow mt-2 overflow-hidden">
		<div class="flex items-center justify-between px-3 pt-3 pb-1">
			<p class="text-xs font-semibold text-on-surface-subtle uppercase tracking-wide">Recent</p>
			<button class="text-xs text-on-surface-subtle hover:text-on-surface" onclick={clearHistory}>
				Clear
			</button>
		</div>
		{#each history as item}
			<button
				class="w-full text-left px-3 py-2 hover:bg-surface-subtle flex flex-col gap-0.5"
				onclick={() => select(item)}
			>
				<span class="text-sm font-medium text-on-surface">{item.title}</span>
				{#if item.subtitle}
					<span class="text-xs text-on-surface-subtle">{item.subtitle}</span>
				{/if}
			</button>
		{/each}
	</div>
{/if}
