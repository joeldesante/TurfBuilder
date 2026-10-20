<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Select from '$components/data-inputs/select/Select.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import Pagination from '$components/data-display/pagination/Pagination.svelte';
	import EmailLogTable from '$components/data-display/email-log-table/EmailLogTable.svelte';
	import type { Page } from '$lib/shared/utils/pagination';
	import type { EmailLogEntry, EmailLogFilters } from '$lib/shared/types/activity';

	interface Props {
		page: Page<EmailLogEntry>;
		filters: EmailLogFilters;
		/** Template keys for the filter. */
		templates: string[];
		onfilter: (filters: EmailLogFilters) => void;
	}

	let { page, filters, templates, onfilter }: Props = $props();

	let recipient = $state('');
	$effect(() => {
		recipient = filters.recipient ?? '';
	});

	const emit = (next: Partial<EmailLogFilters>) =>
		onfilter({ status: filters.status, template: filters.template, recipient: filters.recipient, ...next });

	function pageHref(target: number) {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
		params.set('page', String(target));
		return `?${params}`;
	}
</script>

<PageHeader
	title="Email log"
	subheading="Every email the app tried to send, so you can tell whether a message went out."
	breadcrumbs={[{ label: 'Settings', href: '/infra/settings' }, { label: 'Email log' }]}
/>

<div class="space-y-4">
	<form
		class="flex flex-wrap items-end gap-3"
		onsubmit={(event) => {
			event.preventDefault();
			emit({ recipient: recipient.trim() || undefined });
		}}
	>
		<label class="flex flex-col gap-1 text-sm text-on-surface">
			Address
			<TextInput type="search" bind:value={recipient} placeholder="name@example.com" aria-label="Search by address" class="w-64" />
		</label>
		<Button type="submit" variant="outline">Search</Button>
		<label class="flex flex-col gap-1 text-sm text-on-surface">
			Status
			<Select
				value={filters.status ?? ''}
				aria-label="Status"
				items={[
					{ value: '', label: 'Any' },
					{ value: 'sent', label: 'Sent' },
					{ value: 'skipped', label: 'Not sent' },
					{ value: 'failed', label: 'Failed' }
				]}
				onchange={(event: Event) => emit({ status: ((event.currentTarget as HTMLSelectElement).value || undefined) as EmailLogFilters['status'] })}
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm text-on-surface">
			Template
			<Select
				value={filters.template ?? ''}
				aria-label="Template"
				items={[{ value: '', label: 'Any' }, ...templates.map((key) => ({ value: key, label: key }))]}
				onchange={(event: Event) => emit({ template: (event.currentTarget as HTMLSelectElement).value || undefined })}
			/>
		</label>
	</form>

	<div class="rounded-xl border border-outline-subtle">
		<EmailLogTable items={page.items} emptyText="No emails match." />
		<Pagination page={page.page} totalCount={page.totalCount} pageSize={page.pageSize} noun="emails" href={pageHref} />
	</div>
</div>
