<script lang="ts">
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import TabBar from '$components/layout/tab-bar/TabBar.svelte';
	import type { Tab } from '$components/layout/tab-bar/TabBar.svelte';
	import MetricsWorkflowSidebar from '$components/universe/metrics-workflow-sidebar/MetricsWorkflowSidebar.svelte';
	import type {
		MetricsBucket,
		MetricsWorkflowSelection
	} from '$components/universe/metrics-workflow-sidebar/MetricsWorkflowSidebar.svelte';
	import LocationsMap from '$components/data-display/locations-map/LocationsMap.svelte';
	import LocationResponseDetail from '$components/universe/location-response-detail/LocationResponseDetail.svelte';
	import type { MetricsLocationResult } from '$components/universe/location-response-detail/LocationResponseDetail.svelte';

	interface Props {
		orgSlug: string;
		buckets?: MetricsBucket[];
	}

	const { orgSlug, buckets = [] }: Props = $props();

	const initialTabId: string = crypto.randomUUID();
	let tabs = $state<Tab[]>([{ id: initialTabId, label: 'Tab 1' }]);
	let activeTabId = $state(initialTabId);
	let nextTabNumber = $state(2);

	function selectTab(id: string) {
		activeTabId = id;
	}

	function addTab() {
		const tab: Tab = { id: crypto.randomUUID(), label: `Tab ${nextTabNumber}` };
		nextTabNumber += 1;
		tabs = [...tabs, tab];
		activeTabId = tab.id;
		selectedLocationIds[tab.id] = null;
	}

	function closeTab(id: string) {
		const index = tabs.findIndex((tab) => tab.id === id);
		if (index === -1) return;

		tabs = tabs.filter((tab) => tab.id !== id);
		delete tabSelections[id];
		delete tabResults[id];
		delete tabLoading[id];
		delete tabErrors[id];
		delete selectedLocationIds[id];

		if (activeTabId === id && tabs.length > 0) {
			activeTabId = tabs[Math.max(0, index - 1)].id;
		}
	}

	function reorderTabs(reordered: Tab[]) {
		tabs = reordered;
	}

	let activeTab = $derived(tabs.find((tab) => tab.id === activeTabId) ?? null);

	let tabSelections = $state<Record<string, MetricsWorkflowSelection>>({});
	let tabResults = $state<Record<string, MetricsLocationResult[]>>({});
	let tabLoading = $state<Record<string, boolean>>({});
	let tabErrors = $state<Record<string, string | null>>({});
	let selectedLocationIds = $state<Record<string, string | null>>({ [initialTabId]: null });

	async function handleGenerate(tabId: string, selection: MetricsWorkflowSelection) {
		tabSelections = { ...tabSelections, [tabId]: selection };
		selectedLocationIds[tabId] = null;
		tabLoading = { ...tabLoading, [tabId]: true };
		tabErrors = { ...tabErrors, [tabId]: null };

		const params = new SvelteURLSearchParams({
			bucketId: selection.bucketId,
			surveyId: selection.surveyId
		});
		if (selection.startDate) params.set('startDate', selection.startDate);
		if (selection.endDate) params.set('endDate', selection.endDate);

		try {
			const res = await fetch(`/o/${orgSlug}/s/api/universe/metrics/results?${params}`);
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				tabErrors = { ...tabErrors, [tabId]: body.error ?? 'Failed to load results.' };
				return;
			}
			tabResults = { ...tabResults, [tabId]: await res.json() };
		} catch {
			tabErrors = { ...tabErrors, [tabId]: 'Failed to load results.' };
		} finally {
			tabLoading = { ...tabLoading, [tabId]: false };
		}
	}

	let activeLocations = $derived(activeTab ? (tabResults[activeTab.id] ?? []) : []);
	let activeSelectedLocation = $derived(
		activeTab
			? (activeLocations.find((loc) => loc.id === selectedLocationIds[activeTab!.id]) ?? null)
			: null
	);
</script>

<div>
	<div>
		<TabBar
			{tabs}
			activeId={activeTabId}
			onSelect={selectTab}
			onAdd={addTab}
			onClose={closeTab}
			onReorder={reorderTabs}
		/>

		{#if activeTab}
			{#key activeTab.id}
				<div class="flex">
					<div class="flex-1 flex flex-col min-h-[480px]">
						<LocationsMap
							locations={activeLocations}
							bind:selectedLocationId={selectedLocationIds[activeTab.id]}
							class="flex-1"
						/>
						{#if tabLoading[activeTab.id]}
							<p class="p-2 text-sm text-on-surface-subtle">Loading results...</p>
						{:else if tabErrors[activeTab.id]}
							<p class="p-2 text-sm text-error">{tabErrors[activeTab.id]}</p>
						{/if}
					</div>
					{#if activeSelectedLocation}
						<LocationResponseDetail
							location={activeSelectedLocation}
							onClose={() => (selectedLocationIds[activeTab!.id] = null)}
						/>
					{/if}
					<MetricsWorkflowSidebar
						{orgSlug}
						{buckets}
						onGenerate={(selection) => handleGenerate(activeTab!.id, selection)}
					/>
				</div>
			{/key}
		{/if}
	</div>
</div>
