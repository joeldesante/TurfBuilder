<script lang="ts">
	import Pagination from '$components/data-display/pagination/Pagination.svelte';
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
		bucketName: string;
		/** Whether the people filter is enabled for this bucket. */
		enabled: boolean;
		/** One page of the matches, already ordered and sliced by the server. */
		people: PersonRow[];
		/** Every match across all pages. Defaults to the rows given. */
		totalCount?: number;
		/** 1-based index of the page in `people`. */
		page?: number;
		pageSize?: number;
		/** Base path for person detail links, e.g. /o/myorg/s/universe/buckets/my-bucket/people */
		basePath?: string;
	}

	const {
		bucketName,
		enabled,
		people,
		totalCount: totalCountProp,
		page = 1,
		pageSize = 100,
		basePath = ''
	}: Props = $props();

	const totalCount = $derived(totalCountProp ?? people.length);

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

<div>
	<PageHeader title="People" subheading={bucketName} />

	{#if !enabled}
		<p class="text-on-surface-subtle mt-4">
			This bucket does not include a people filter.
		</p>
	{:else if people.length === 0}
		<p class="text-on-surface-subtle mt-4">
			No people match the filters defined for this bucket.
		</p>
	{:else}
		<p class="text-sm text-on-surface-subtle my-4">
			{totalCount.toLocaleString()} {totalCount === 1 ? 'person' : 'people'} matched
		</p>

		<div class="border-t border-outline-subtle">
			<Pagination {page} {totalCount} {pageSize} noun="people" />
			<div class="flex items-center gap-4 px-4 py-2">
				<div class="w-8 shrink-0"></div>
				<span class="flex-1 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Name</span>
				<span class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide w-28 text-right">Date of Birth</span>
			</div>

			{#each people as person (person.id)}
				<a
					href="{basePath}/{person.id}"
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
			{/each}
		</div>

		<Pagination {page} {totalCount} {pageSize} noun="people" />
	{/if}
</div>
