<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import EntityBrowserRow from '$components/data-display/entity-browser/EntityBrowserRow.svelte';
	import EnvelopeIcon from 'phosphor-svelte/lib/Envelope';

	interface EmailTemplate {
		key: string;
		subject: string;
		updated_at: string;
	}

	interface Props {
		templates: EmailTemplate[];
		templateHref: (key: string) => string;
	}

	const { templates, templateHref }: Props = $props();
</script>

<PageHeader
	title="Email Templates"
	subheading="Edit the HTML and subject for each transactional email sent by this installation."
/>

<div class="border-t border-outline-subtle">
	<div class="flex items-center gap-4 px-4 py-2">
		<div class="w-8 shrink-0"></div>
		<span class="flex-1 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Template</span>
		<span class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide w-36 text-right">Last Updated</span>
	</div>

	{#each templates as template}
		<EntityBrowserRow
			name={template.subject}
			date={template.updated_at}
			href={templateHref(template.key)}
			icon={EnvelopeIcon}
		/>
	{:else}
		<p class="px-4 py-8 text-sm text-on-surface-subtle text-center">No templates found.</p>
	{/each}
</div>
