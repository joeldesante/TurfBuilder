<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import TurfPreviewModal from './TurfPreviewModal.svelte';
	import UsersIcon from 'phosphor-svelte/lib/Users';
	import MapPinIcon from 'phosphor-svelte/lib/MapPin';
	import CalendarIcon from 'phosphor-svelte/lib/Calendar';
	import ScissorsIcon from 'phosphor-svelte/lib/Scissors';
	import EyeIcon from 'phosphor-svelte/lib/Eye';

	export interface TurfEntry {
		id: string;
		code: string;
		expires_at: string;
		created_at: string;
		author: string;
		survey_name: string | null;
		location_count: string;
	}

	export interface PersonEntry {
		record_id: string;
		record_source: string;
		entity_id: string;
		first_name: string | null;
		last_name: string | null;
		email: string | null;
		phone: string | null;
	}

	export interface LocationEntry {
		record_id: string;
		record_source: string;
		entity_id: string;
		name: string | null;
		address_line_1: string | null;
		city: string | null;
		state_or_region: string | null;
		postal_code: string | null;
	}

	interface Props {
		orgSlug: string;
		bucketName: string;
		bucketSlug: string;
		/** The URL of this list detail page, used to build the "Back" link on the entity detail page. */
		listHref: string;
		list: {
			id: string;
			name: string;
			entity_type: string;
			expires_at: string;
			created_at: string;
		};
		entries: PersonEntry[] | LocationEntry[];
		turfs: TurfEntry[];
	}

	const { orgSlug, bucketName, bucketSlug, listHref, list, entries, turfs }: Props = $props();

	const isPeople = $derived(list.entity_type === 'people');
	const isExpired = $derived(new Date(list.expires_at) < new Date());

	type Tab = 'entries' | 'turfs';
	let activeTab = $state<Tab>('entries');

	function entityHref(entry: PersonEntry | LocationEntry): string {
		return `/o/${orgSlug}/s/universe/entity/${entry.entity_id}?version=${entry.record_id}&backHref=${encodeURIComponent(listHref)}`;
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function isTurfExpired(turf: TurfEntry): boolean {
		return new Date(turf.expires_at) < new Date();
	}

	function fullName(entry: PersonEntry): string {
		const parts = [entry.first_name, entry.last_name].filter(Boolean);
		return parts.length > 0 ? parts.join(' ') : 'Unknown';
	}

	function locationLabel(entry: LocationEntry): string {
		return entry.name ?? entry.address_line_1 ?? 'Unknown';
	}

	let previewTurf = $state<TurfEntry | null>(null);

	function tabClass(tab: Tab): string {
		const base = 'inline-flex items-center gap-2 rounded-lg px-4 h-9 text-sm font-medium border transition-colors cursor-pointer';
		return tab === activeTab
			? `${base} bg-primary text-on-primary border-primary`
			: `${base} bg-surface text-on-surface border-outline-subtle hover:bg-surface-container`;
	}
</script>

<PageHeader title={list.name} subheading={bucketName}>
	{#snippet actions()}
		{#if !isPeople}
			<Button href={`/o/${orgSlug}/s/universe/buckets/${bucketSlug}/lists/${list.id}/cut`}>
				<ScissorsIcon class="size-4" />
				Cut Turfs
			</Button>
		{/if}
	{/snippet}
</PageHeader>

<div class="flex items-center gap-6 px-4 py-3 border-b border-outline-subtle text-sm text-on-surface-subtle">
	<div class="flex items-center gap-1.5">
		{#if isPeople}
			<UsersIcon class="size-4 shrink-0" />
			<span>People</span>
		{:else}
			<MapPinIcon class="size-4 shrink-0" />
			<span>Locations</span>
		{/if}
	</div>

	<div class="flex items-center gap-1.5">
		<CalendarIcon class="size-4 shrink-0" />
		<span class={isExpired ? 'text-error' : ''}>{isExpired ? 'Expired' : 'Expires'} {formatDate(list.expires_at)}</span>
	</div>
</div>

{#if !isPeople}
	<div class="flex items-center gap-2 px-4 py-3 border-b border-outline-subtle">
		<button class={tabClass('entries')} onclick={() => (activeTab = 'entries')}>
			Locations
			<span class="text-xs rounded-full px-1.5 py-0.5 font-normal {activeTab === 'entries' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container text-on-surface-subtle'}">{entries.length}</span>
		</button>
		<button class={tabClass('turfs')} onclick={() => (activeTab = 'turfs')}>
			Turfs
			<span class="text-xs rounded-full px-1.5 py-0.5 font-normal {activeTab === 'turfs' ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container text-on-surface-subtle'}">{turfs.length}</span>
		</button>
	</div>
{/if}

{#if activeTab === 'entries' || isPeople}
	<div class="border-t border-outline-subtle">
		{#if isPeople}
			<div class="flex items-center gap-4 px-4 py-2">
				<span class="w-48 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Name</span>
				<span class="flex-1 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Email</span>
				<span class="w-36 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Phone</span>
			</div>

			{#each entries as entry (entry.record_id)}
				{@const p = entry as PersonEntry}
				<a
					href={entityHref(p)}
					class="flex items-center gap-4 px-4 py-3 border-b border-outline-subtle hover:bg-surface-container transition-colors group"
				>
					<span class="w-48 text-sm text-on-surface font-medium truncate group-hover:text-primary transition-colors">{fullName(p)}</span>
					<span class="flex-1 text-sm text-on-surface-subtle truncate">{p.email ?? '—'}</span>
					<span class="w-36 text-sm text-on-surface-subtle">{p.phone ?? '—'}</span>
				</a>
			{:else}
				<p class="px-4 py-8 text-sm text-on-surface-subtle text-center">No entries in this list.</p>
			{/each}
		{:else}
			<div class="flex items-center gap-4 px-4 py-2">
				<span class="flex-1 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Name / Address</span>
				<span class="w-48 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">City</span>
				<span class="w-20 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">State</span>
				<span class="w-24 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">ZIP</span>
			</div>

			{#each entries as entry (entry.record_id)}
				{@const l = entry as LocationEntry}
				<a
					href={entityHref(l)}
					class="flex items-center gap-4 px-4 py-3 border-b border-outline-subtle hover:bg-surface-container transition-colors group"
				>
					<div class="flex-1 min-w-0">
						<p class="text-sm text-on-surface font-medium truncate group-hover:text-primary transition-colors">{locationLabel(l)}</p>
						{#if l.address_line_1 && l.name}
							<p class="text-xs text-on-surface-subtle truncate">{l.address_line_1}</p>
						{/if}
					</div>
					<span class="w-48 text-sm text-on-surface-subtle truncate">{l.city ?? '—'}</span>
					<span class="w-20 text-sm text-on-surface-subtle">{l.state_or_region ?? '—'}</span>
					<span class="w-24 text-sm text-on-surface-subtle">{l.postal_code ?? '—'}</span>
				</a>
			{:else}
				<p class="px-4 py-8 text-sm text-on-surface-subtle text-center">No entries in this list.</p>
			{/each}
		{/if}
	</div>
{:else}
	<div class="border-t border-outline-subtle">
		<div class="flex items-center gap-4 px-4 py-2">
			<span class="w-28 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Code</span>
			<span class="flex-1 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Survey</span>
			<span class="w-32 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Author</span>
			<span class="w-24 text-xs font-medium text-on-surface-subtle uppercase tracking-wide text-right">Locations</span>
			<span class="w-32 text-xs font-medium text-on-surface-subtle uppercase tracking-wide text-right">Expires</span>
			<span class="w-8"></span>
		</div>

		{#each turfs as turf (turf.id)}
			<div class="flex items-center gap-4 px-4 py-3 border-t border-outline-subtle">
				<span class="w-28 font-mono text-sm font-medium text-on-surface">{turf.code}</span>
				<span class="flex-1 text-sm text-on-surface-subtle truncate">{turf.survey_name ?? '—'}</span>
				<span class="w-32 text-sm text-on-surface-subtle truncate">{turf.author}</span>
				<span class="w-24 text-sm text-on-surface-subtle text-right">{turf.location_count}</span>
				<span class={['w-32 text-sm text-right', isTurfExpired(turf) ? 'text-error' : 'text-on-surface-subtle'].join(' ')}>
					{isTurfExpired(turf) ? 'Expired' : formatDate(turf.expires_at)}
				</span>
				<div class="w-8 flex justify-end">
					<button
						onclick={() => (previewTurf = turf)}
						class="p-1 rounded text-on-surface-subtle hover:text-on-surface hover:bg-surface-container transition-colors"
						aria-label="Preview turf {turf.code}"
					>
						<EyeIcon class="size-4" />
					</button>
				</div>
			</div>
		{:else}
			<p class="px-4 py-6 text-sm text-on-surface-subtle text-center">No turfs cut yet.</p>
		{/each}
	</div>
{/if}

{#if previewTurf}
	<TurfPreviewModal
		turfId={previewTurf.id}
		turfCode={previewTurf.code}
		{orgSlug}
		open={previewTurf !== null}
		onClose={() => (previewTurf = null)}
	/>
{/if}
