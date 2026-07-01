<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeft';
	import WarningIcon from 'phosphor-svelte/lib/Warning';

	// ---------------------------------------------------------------------------
	// Person record shape
	// ---------------------------------------------------------------------------

	export interface PersonRecord {
		id: string;
		entity_id: string;
		first_name: string | null;
		middle_name: string | null;
		last_name: string | null;
		suffix: string | null;
		preferred_name: string | null;
		dob: string | Date | null;
		phone: string | null;
		email: string | null;
		gender: string | null;
		valid_to: string | null;
		source: 'public' | 'org';
	}

	// ---------------------------------------------------------------------------
	// Location record shape
	// ---------------------------------------------------------------------------

	export interface LocationRecord {
		id: string;
		entity_id: string;
		name: string | null;
		address_line_1: string | null;
		address_line_2: string | null;
		address_line_3: string | null;
		city: string | null;
		state_or_region: string | null;
		postal_code: string | null;
		country_code: string | null;
		valid_to: string | null;
		source: 'public' | 'org';
	}

	interface Props {
		orgSlug: string;
		entityType: 'person' | 'location';
		entityId: string;
		record: PersonRecord | LocationRecord;
		isOutdated: boolean;
		/** URL to navigate back (e.g. the list detail page). Optional. */
		backHref?: string;
	}

	const { orgSlug, entityType, entityId, record, isOutdated, backHref }: Props = $props();

	const latestHref = $derived(
		`/o/${orgSlug}/s/universe/entity/${entityId}`
	);

	// ---------------------------------------------------------------------------
	// Person helpers
	// ---------------------------------------------------------------------------

	function fullName(p: PersonRecord): string {
		const parts = [p.first_name, p.middle_name, p.last_name, p.suffix].filter(Boolean);
		return parts.join(' ') || 'Unknown Person';
	}

	function formatDob(dob: Date | string | null): string {
		if (!dob) return '';
		const d = dob instanceof Date ? dob : new Date(dob);
		if (isNaN(d.getTime())) return '';
		return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
	}

	function formatAge(dob: Date | string | null): string {
		if (!dob) return '';
		const d = dob instanceof Date ? dob : new Date(dob);
		if (isNaN(d.getTime())) return '';
		const today = new Date();
		let age = today.getUTCFullYear() - d.getUTCFullYear();
		const m = today.getUTCMonth() - d.getUTCMonth();
		if (m < 0 || (m === 0 && today.getUTCDate() < d.getUTCDate())) age--;
		return String(age);
	}

	// ---------------------------------------------------------------------------
	// Field rendering
	// ---------------------------------------------------------------------------

	interface Field { label: string; value: string | null | undefined }

	const fields = $derived<Field[]>(
		entityType === 'person'
			? (() => {
					const p = record as PersonRecord;
					return [
						{ label: 'First Name', value: p.first_name },
						{ label: 'Middle Name', value: p.middle_name },
						{ label: 'Last Name', value: p.last_name },
						{ label: 'Suffix', value: p.suffix },
						{ label: 'Preferred Name', value: p.preferred_name },
						{
							label: 'Date of Birth',
							value: p.dob ? `${formatDob(p.dob)} (age ${formatAge(p.dob)})` : null
						},
						{ label: 'Phone', value: p.phone },
						{ label: 'Email', value: p.email },
						{ label: 'Gender', value: p.gender },
						{
							label: 'Data Source',
							value: p.source === 'public' ? 'Public record' : 'Organization record'
						}
					].filter((f) => f.value != null && f.value !== '') as Field[];
				})()
			: (() => {
					const l = record as LocationRecord;
					return [
						{ label: 'Name', value: l.name },
						{ label: 'Address Line 1', value: l.address_line_1 },
						{ label: 'Address Line 2', value: l.address_line_2 },
						{ label: 'Address Line 3', value: l.address_line_3 },
						{ label: 'City', value: l.city },
						{ label: 'State / Region', value: l.state_or_region },
						{ label: 'Postal Code', value: l.postal_code },
						{ label: 'Country', value: l.country_code },
						{
							label: 'Data Source',
							value: l.source === 'public' ? 'Public record' : 'Organization record'
						}
					].filter((f) => f.value != null && f.value !== '') as Field[];
				})()
	);

	const pageTitle = $derived(
		entityType === 'person'
			? fullName(record as PersonRecord)
			: (() => {
					const l = record as LocationRecord;
					if (l.name) return l.name;
					const parts = [l.address_line_1, l.city, l.state_or_region].filter(Boolean);
					return parts.join(', ') || 'Unknown Location';
				})()
	);

	const pageSubheading = $derived(
		entityType === 'person'
			? ((record as PersonRecord).preferred_name
					? `Goes by "${(record as PersonRecord).preferred_name}"`
					: undefined)
			: undefined
	);
</script>

<div class="pt-4">
	{#if backHref}
		<a
			href={backHref}
			class="inline-flex items-center gap-1 text-sm text-on-surface-subtle hover:text-on-surface mb-4 transition-colors"
		>
			<ArrowLeftIcon size={14} />
			Back to List
		</a>
	{/if}

	{#if isOutdated}
		<div class="mb-4 flex items-start gap-3 rounded-lg border border-warning bg-warning/10 px-4 py-3 text-sm">
			<WarningIcon class="size-4 shrink-0 mt-0.5 text-warning" />
			<span>
				You are viewing an older version of this record that has since been updated.
				<a href={latestHref} class="font-medium underline hover:no-underline">
					View the latest version here.
				</a>
			</span>
		</div>
	{/if}

	<PageHeader title={pageTitle} subheading={pageSubheading} class={backHref ? 'pt-0' : ''} />

	<dl class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
		{#each fields as field}
			<div>
				<dt class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide">{field.label}</dt>
				<dd class="mt-0.5 text-sm">{field.value}</dd>
			</div>
		{/each}
	</dl>
</div>
