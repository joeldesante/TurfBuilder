<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import UserIcon from 'phosphor-svelte/lib/User';

	export interface PersonRow {
		id: string;
		first_name: string | null;
		last_name: string | null;
		email: string | null;
		phone: string | null;
		dob: Date | string | null;
	}

	interface Props {
		orgSlug: string;
		totalCount: number;
		people: PersonRow[];
	}

	const { orgSlug, totalCount, people }: Props = $props();

	function formatName(row: PersonRow): string {
		const parts = [row.first_name, row.last_name].filter(Boolean);
		return parts.length > 0 ? parts.join(' ') : 'Unknown';
	}

	function formatDob(dob: Date | string | null): string {
		if (!dob) return '';
		const d = dob instanceof Date ? dob : new Date(dob);
		if (isNaN(d.getTime())) return '';
		return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
	}

	function secondaryInfo(row: PersonRow): string {
		return [row.email, row.phone].filter(Boolean).join(' · ');
	}
</script>

<PageHeader
	title="People"
	subheading="All people records in this organization's universe."
/>

<div class="border-t border-outline-subtle">
	<div class="flex items-center gap-4 px-4 py-2">
		<div class="w-8 shrink-0"></div>
		<span class="flex-1 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Name</span>
		<span class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide w-28 text-right">Date of Birth</span>
	</div>

	{#each people as person (person.id)}
		<a
			href="/o/{orgSlug}/s/universe/people/{person.id}"
			class="flex items-center gap-4 px-4 py-3 border-b border-outline-subtle hover:bg-surface-container transition-colors duration-100 group"
		>
			<div class="w-8 h-8 shrink-0 flex items-center justify-center text-on-surface-subtle">
				<UserIcon size={20} />
			</div>
			<div class="flex-1 min-w-0">
				<span class="block text-sm text-on-surface truncate group-hover:text-primary transition-colors">
					{formatName(person)}
				</span>
				{#if secondaryInfo(person)}
					<span class="block text-xs text-on-surface-subtle truncate mt-0.5">
						{secondaryInfo(person)}
					</span>
				{/if}
			</div>
			<span class="text-sm text-on-surface-subtle w-28 shrink-0 text-right">{formatDob(person.dob)}</span>
		</a>
	{:else}
		<p class="px-4 py-8 text-sm text-on-surface-subtle text-center">No people records found.</p>
	{/each}

	{#if people.length < totalCount}
		<p class="px-4 py-3 text-xs text-on-surface-subtle text-center">
			Showing {people.length.toLocaleString()} of {totalCount.toLocaleString()} records.
			Use <a href="/o/{orgSlug}/s/universe/search" class="underline hover:text-on-surface">Quick Search</a> to filter.
		</p>
	{/if}
</div>
