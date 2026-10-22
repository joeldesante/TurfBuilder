<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Pagination from '$components/data-display/pagination/Pagination.svelte';
	import AuditLogTable from '$components/data-display/audit-log-table/AuditLogTable.svelte';
	import Select from '$components/data-inputs/select/Select.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import { AUDIT_ACTIONS } from '$lib/shared/registries/audit-actions';
	import type { Page } from '$lib/shared/utils/pagination';
	import type { AuditEntry, AuditFilters } from '$lib/shared/types/audit';

	interface Props {
		page: Page<AuditEntry>;
		filters: AuditFilters;
		onfilter: (filters: AuditFilters) => void;
	}

	let { page, filters, onfilter }: Props = $props();

	let from = $state('');
	let to = $state('');
	$effect.pre(() => {
		from = filters.from ?? '';
		to = filters.to ?? '';
	});

	const TARGET_TYPES: { value: string; label: string }[] = [
		{ value: '', label: 'Anything' },
		{ value: 'user', label: 'Users' },
		{ value: 'organization', label: 'Organizations' },
		{ value: 'session', label: 'Sessions' },
		{ value: 'setting', label: 'Settings' },
		{ value: 'email_template', label: 'Email templates' },
		{ value: 'infra_role', label: 'Infrastructure roles' },
		{ value: 'system', label: 'System' }
	];

	const actionItems = [
		{ value: '', label: 'Any change' },
		...Object.entries(AUDIT_ACTIONS).map(([value, label]) => ({ value, label }))
	];

	const emit = (next: Partial<AuditFilters>) => onfilter({ ...filters, ...next });

	function pageHref(target: number) {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(filters)) if (value) params.set(key, String(value));
		params.set('page', String(target));
		return `?${params}`;
	}

	function targetHref(type: AuditEntry['targetType'], id: string): string | null {
		if (type === 'user') return `/infra/users/${id}`;
		if (type === 'organization') return `/infra/orgs/${id}`;
		return null;
	}
</script>

<PageHeader title="Audit log" subheading="Every change an infrastructure admin has made, and who made it." />

<div class="space-y-4">
	<form
		class="flex flex-wrap items-end gap-3"
		onsubmit={(event) => {
			event.preventDefault();
			emit({ from: from || undefined, to: to || undefined });
		}}
	>
		<label class="flex flex-col gap-1 text-sm text-on-surface">
			Change
			<Select
				value={filters.action ?? ''}
				items={actionItems}
				onchange={(event: Event) => emit({ action: (event.currentTarget as HTMLSelectElement).value || undefined })}
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm text-on-surface">
			Made to
			<Select
				value={filters.targetType ?? ''}
				items={TARGET_TYPES}
				onchange={(event: Event) => emit({ targetType: ((event.currentTarget as HTMLSelectElement).value || undefined) as AuditFilters['targetType'] })}
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm text-on-surface">
			From
			<TextInput type="date" bind:value={from} />
		</label>
		<label class="flex flex-col gap-1 text-sm text-on-surface">
			To
			<TextInput type="date" bind:value={to} />
		</label>
		<Button type="submit" variant="outline">Apply dates</Button>
	</form>

	<div class="rounded-xl border border-outline-subtle">
		<AuditLogTable items={page.items} {targetHref} emptyText="No changes match." />
		<Pagination page={page.page} totalCount={page.totalCount} pageSize={page.pageSize} noun="changes" href={pageHref} />
	</div>
</div>
