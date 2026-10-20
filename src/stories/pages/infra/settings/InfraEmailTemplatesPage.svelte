<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Badge from '$components/data-display/badge/Badge.svelte';
	import { formatDate } from '$lib/shared/utils/format-date';
	import type { EmailTemplateSummary } from '$lib/shared/types/email-templates';

	interface Props {
		templates: EmailTemplateSummary[];
	}

	let { templates }: Props = $props();
</script>

<PageHeader
	title="Email templates"
	subheading="The emails the app sends. Edit the wording; the variables each one can use are fixed."
	breadcrumbs={[{ label: 'Settings', href: '/infra/settings' }, { label: 'Email templates' }]}
/>

{#if templates.length === 0}
	<p class="py-8 text-center text-sm text-on-surface-subtle">No email templates yet. Run a migration to create them.</p>
{:else}
	<ul class="divide-y divide-outline-subtle rounded-xl border border-outline-subtle">
		{#each templates as template (template.key)}
			<li>
				<a
					href={`/infra/settings/email/templates/${template.key}`}
					class="flex flex-col gap-1 px-4 py-3 no-underline hover:bg-surface-container-low sm:flex-row sm:items-center sm:justify-between"
				>
					<span class="min-w-0">
						<span class="block font-medium text-on-surface">{template.name}</span>
						<span class="block text-sm text-on-surface-subtle">{template.description}</span>
						<span class="mt-1 block truncate text-sm text-on-surface-subtle">Subject: {template.subject}</span>
					</span>
					<span class="flex shrink-0 items-center gap-2 text-xs text-on-surface-subtle">
						{#if template.customized}
							<Badge size="sm" variant="info">Edited</Badge>
						{:else}
							<Badge size="sm">Default</Badge>
						{/if}
						Updated {formatDate(template.updatedAt)}
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
