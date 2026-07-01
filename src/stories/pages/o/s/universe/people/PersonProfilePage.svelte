<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeft';

	export interface PersonProfile {
		id: string;
		first_name: string | null;
		middle_name: string | null;
		last_name: string | null;
		suffix: string | null;
		preferred_name: string | null;
		dob: Date | string | null;
		phone: string | null;
		email: string | null;
		gender: string | null;
		source: 'public' | 'org';
	}

	interface Props {
		person: PersonProfile;
		/** URL to navigate back to the people list. */
		backHref: string;
	}

	const { person, backHref }: Props = $props();

	function fullName(p: PersonProfile): string {
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

	interface Field {
		label: string;
		value: string | null | undefined;
	}

	const fields = $derived<Field[]>([
		{ label: 'First Name', value: person.first_name },
		{ label: 'Middle Name', value: person.middle_name },
		{ label: 'Last Name', value: person.last_name },
		{ label: 'Suffix', value: person.suffix },
		{ label: 'Preferred Name', value: person.preferred_name },
		{ label: 'Date of Birth', value: person.dob ? `${formatDob(person.dob)} (age ${formatAge(person.dob)})` : null },
		{ label: 'Phone', value: person.phone },
		{ label: 'Email', value: person.email },
		{ label: 'Gender', value: person.gender },
		{ label: 'Data Source', value: person.source === 'public' ? 'Public record' : 'Organization record' },
	].filter((f) => f.value));
</script>

<div class="pt-4">
	<a
		href={backHref}
		class="inline-flex items-center gap-1 text-sm text-on-surface-subtle hover:text-on-surface mb-4 transition-colors"
	>
		<ArrowLeftIcon size={14} />
		Back to People
	</a>

	<PageHeader title={fullName(person)} subheading={person.preferred_name ? `Goes by "${person.preferred_name}"` : undefined} class="pt-0" />

	<dl class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
		{#each fields as field}
			<div>
				<dt class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide">{field.label}</dt>
				<dd class="mt-0.5 text-sm">{field.value}</dd>
			</div>
		{/each}
	</dl>
</div>
