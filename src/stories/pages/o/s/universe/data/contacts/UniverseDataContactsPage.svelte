<script lang="ts">
	import ReorderList from '$components/layout/reorder-list/ReorderList.svelte';
	import Pagination from '$components/data-display/pagination/Pagination.svelte';
	import LocationsMap, {
		type MapLocation
	} from '$components/data-display/locations-map/LocationsMap.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Tabs from '$components/layout/tabs/Tabs.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import EntityFilterEditor from '$components/universe/entity-filter-editor/EntityFilterEditor.svelte';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimple';
	import FunnelIcon from 'phosphor-svelte/lib/Funnel';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import type { AllContact, ContactSchema, SchemaContact } from '$lib/shared/types/contact-schemas';
	import type { FilterGroup } from '$lib/shared/types/filters';
	import { filtersFor } from '$lib/shared/utils/filter-registry';
	import { isFilterGroup } from '$lib/shared/utils/filters';

	interface Props {
		orgSlug: string;
		/** The organization the filters that name its buckets, lists, or surveys load their choices from. */
		orgId?: string;
		/** The text the contacts are searched for. Empty shows every contact. */
		search?: string;
		/** The filters applied to the contacts, in the filter editor's own shape. Null applies none. */
		filters?: FilterGroup | null;
		/**
		 * Applies a new search and set of filters: the page loads again with them.
		 * Without it the search and Filters controls are not shown.
		 */
		onFilter?: (next: { search: string; filters: FilterGroup | null }) => void;
		/** Every contact schema the org has, in the order staff arranged them. Each is a tab after "All". */
		schemas: ContactSchema[];
		/** The schema whose contacts are shown. Null shows the "All" tab. */
		selected: ContactSchema | null;
		/** How the contacts are shown. @default 'list' */
		view?: 'list' | 'map';
		/** The pins for the map view: the shown tab's contacts that have a position. */
		markers?: MapLocation[];
		/** One page of contacts, already ordered by the server. On the "All" tab each also names its schema. */
		contacts: (SchemaContact | AllContact)[];
		totalCount: number;
		page?: number;
		pageSize?: number;
		/** Saves the new tab order after a drag. Without it the tabs cannot be dragged. */
		onReorder?: (ids: string[]) => Promise<void>;
		/** Called when Import contacts is pressed. The importer is not built yet, so nothing is passed for now. */
		onImport?: () => void;
	}

	const {
		orgSlug,
		orgId,
		search = '',
		filters = null,
		onFilter,
		schemas,
		selected,
		view = 'list',
		markers = [],
		contacts,
		totalCount,
		page = 1,
		pageSize = 100,
		onReorder,
		onImport
	}: Props = $props();

	const base = $derived(`/o/${orgSlug}/s/universe/data/contacts`);
	const columns = $derived(selected ? selected.fields : []);
	const fieldsBySchema = $derived(new Map(schemas.map((s) => [s.id, s.fields])));
	const viewParam = $derived(view === 'map' ? 'view=map' : '');
	// Links keep the search and filters, so switching tab, view, or page does not lose them.
	const keptParams = $derived(
		[
			search ? `q=${encodeURIComponent(search)}` : '',
			filters && filters.filters.length > 0
				? `filters=${encodeURIComponent(JSON.stringify(filters))}`
				: ''
		].filter(Boolean)
	);
	const query = (...parts: string[]) => {
		const joined = parts.filter(Boolean).join('&');
		return joined ? `?${joined}` : '';
	};
	const baseHref = $derived(`${base}${query(viewParam, ...keptParams)}`);
	const tabHref = (id: string) => `${base}${query(`schema=${id}`, viewParam, ...keptParams)}`;
	const pageHref = (target: number) =>
		query(selected ? `schema=${selected.id}` : '', ...keptParams, `page=${target}`);
	const viewHref = (target: 'list' | 'map') =>
		`${base}${query(selected ? `schema=${selected.id}` : '', target === 'map' ? 'view=map' : '', ...keptParams)}`;

	// The search box and the filter panel are drafts until the person applies them.
	let searchText = $state('');
	let panelOpen = $state(false);
	let draft = $state<FilterGroup>({ operator: 'AND', filters: [] });
	$effect(() => {
		searchText = search;
	});
	$effect(() => {
		draft = filters ?? { operator: 'AND', filters: [] };
	});

	/** How many filters are applied, counting those inside groups. */
	function countFilters(group: FilterGroup | null): number {
		if (!group) return 0;
		return group.filters.reduce(
			(total, entry) => total + (isFilterGroup(entry) ? countFilters(entry) : 1),
			0
		);
	}
	const appliedCount = $derived(countFilters(filters));

	function applySearch(event: SubmitEvent) {
		event.preventDefault();
		onFilter?.({ search: searchText.trim(), filters });
	}

	function applyFilters() {
		panelOpen = false;
		onFilter?.({ search: searchText.trim(), filters: draft.filters.length > 0 ? draft : null });
	}

	function clearFilters() {
		draft = { operator: 'AND', filters: [] };
		panelOpen = false;
		onFilter?.({ search: searchText.trim(), filters: null });
	}
	const viewTabs = $derived([
		{ id: 'list', label: 'List', href: viewHref('list') },
		{ id: 'map', label: 'Map', href: viewHref('map') }
	]);

	function show(value: unknown): string {
		if (value === null || value === undefined) return '';
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		return String(value);
	}

	/**
	 * A contact's values as "Name: value", in its schema's field order. Values are
	 * stored under field ids, so the names come from the schema. A contact with no
	 * schema keeps the keys it was imported with.
	 */
	function details(contact: SchemaContact | AllContact): string {
		const fields =
			'schema_id' in contact && contact.schema_id ? fieldsBySchema.get(contact.schema_id) : null;
		if (!fields) {
			return Object.entries(contact.metadata)
				.map(([key, value]) => `${key}: ${show(value)}`)
				.join(', ');
		}
		return fields
			.filter((field) => contact.metadata[field.id] !== undefined)
			.map((field) => `${field.name}: ${show(contact.metadata[field.id])}`)
			.join(', ');
	}

	const tabClass = (active: boolean) =>
		`block px-3 py-2 text-sm font-medium no-underline hover:no-underline border-b-2 -mb-px ${
			active
				? 'border-primary text-on-surface'
				: 'border-transparent text-on-surface-subtle hover:text-on-surface'
		}`;

	const schemaIds = $derived(schemas.map((s) => s.id));
	const schemaName = (id: string) => schemas.find((s) => s.id === id)?.schema_name ?? '';
</script>

<PageHeader title="Contacts">
	{#snippet actions()}
		<Tabs tabs={viewTabs} active={view} label="Contact view" />
		<Button variant="outline" onclick={onImport}>
			<UploadSimpleIcon />
			Import Contacts
		</Button>
	{/snippet}
</PageHeader>

{#if onFilter}
	<div class="flex flex-wrap items-center gap-2 px-4 pb-3">
		<form role="search" class="min-w-48 max-w-md flex-1" onsubmit={applySearch}>
			<TextInput
				type="search"
				bind:value={searchText}
				placeholder="Search contacts"
				aria-label="Search contacts"
				class="w-full"
			/>
		</form>
		<Button variant="outline" aria-expanded={panelOpen} onclick={() => (panelOpen = !panelOpen)}>
			<FunnelIcon />
			Filters
			{#if appliedCount > 0}
				<span
					class="rounded-full bg-primary px-2 text-xs tabular-nums text-on-primary"
					aria-label="{appliedCount} applied"
				>
					{appliedCount}
				</span>
			{/if}
		</Button>
	</div>

	{#if panelOpen}
		<section
			class="mx-4 mb-4 flex flex-col gap-3 rounded-lg border border-outline p-4"
			aria-label="Contact filters"
		>
			<EntityFilterEditor
				entity="locations"
				catalog={filtersFor('locations')}
				{orgId}
				label="Show contacts that match"
				group={draft}
				onchange={(next) => (draft = next)}
			/>
			<div class="flex gap-2">
				<Button onclick={applyFilters}>Apply Filters</Button>
				<Button variant="ghost" onclick={clearFilters}>Clear Filters</Button>
			</div>
		</section>
	{/if}
{/if}

<nav class="flex gap-1 border-b border-outline-subtle px-4 pt-2" aria-label="Contact schemas">
	<a
		href={baseHref}
		aria-current={selected === null ? 'page' : undefined}
		class={tabClass(selected === null)}
	>
		All
	</a>
	<ReorderList
		ids={schemaIds}
		{onReorder}
		class="flex gap-1"
		itemClass={() => (onReorder ? 'cursor-grab touch-pan-y' : '')}
	>
		{#snippet item(id)}
			<a
				href={tabHref(id)}
				draggable="false"
				aria-current={selected?.id === id ? 'page' : undefined}
				class={tabClass(selected?.id === id)}
			>
				{schemaName(id)}
			</a>
		{/snippet}
	</ReorderList>
</nav>

{#if schemas.length === 0}
	<p class="px-4 pt-4 text-sm text-on-surface-subtle">
		Contacts are grouped by schema, and this organization has none yet.
		<a
			class="font-medium text-primary hover:underline"
			href="/o/{orgSlug}/s/universe/data/contact-schemas">Create a contact schema</a
		>
	</p>
{/if}

{#if view === 'map'}
	{#if markers.length === 0}
		<p class="px-4 py-6 text-sm text-on-surface-subtle">
			No contacts here have a position to show on the map.
		</p>
	{:else}
		<LocationsMap locations={markers} autoFit class="h-[32rem] w-full" />
	{/if}
{:else}
	<Pagination {page} {totalCount} {pageSize} noun="contacts" href={pageHref} />

	{#if contacts.length === 0}
		<p class="px-4 py-6 text-sm text-on-surface-subtle">
			{selected ? 'No contacts use this schema yet.' : 'No contacts yet.'}
		</p>
	{:else}
		<table class="w-full text-sm">
			<thead class="text-left text-xs font-medium text-on-surface-subtle uppercase tracking-wide">
				<tr>
					<th class="px-4 py-2">Identifier</th>
					{#if selected}
						{#each columns as column (column.id)}
							<th class="px-4 py-2">{column.name}</th>
						{/each}
					{:else}
						<th class="px-4 py-2">Schema</th>
						<th class="px-4 py-2">Details</th>
					{/if}
				</tr>
			</thead>
			<tbody class="divide-y divide-outline-subtle">
				{#each contacts as contact (contact.id)}
					<tr>
						<td class="px-4 py-3 font-medium text-on-surface">{contact.identifier ?? ''}</td>
						{#if selected}
							{#each columns as column (column.id)}
								<td class="px-4 py-3 text-on-surface">{show(contact.metadata[column.id])}</td>
							{/each}
						{:else}
							<td class="px-4 py-3 text-on-surface-subtle">
								{'schema_name' in contact ? (contact.schema_name ?? 'None') : ''}
							</td>
							<td class="px-4 py-3 text-on-surface">{details(contact)}</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
{/if}
