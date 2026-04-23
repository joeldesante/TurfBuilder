<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';

	interface Org {
		id: string;
		name: string;
		slug: string;
	}

	interface Props {
		orgs: Org[];
		allowCreation?: boolean;
		onSelect: (org: Org) => void;
	}

	const { orgs, allowCreation = false, onSelect }: Props = $props();
</script>

<div class="max-w-md mx-auto pt-16 px-4">
	<PageHeader title="Select Organization" />

	<div class="flex flex-col gap-3 mt-6">
		{#each orgs as org}
			<button
				type="button"
				onclick={() => onSelect(org)}
				class="text-left border rounded-lg px-4 py-3 hover:bg-surface-hover transition-colors"
			>
				<p class="font-medium">{org.name}</p>
				<p class="text-sm text-muted font-mono">/o/{org.slug}/</p>
			</button>
		{/each}

		{#if allowCreation}
			<a href="/orgs/create" class="text-sm text-center text-muted hover:underline mt-2">
				Create a new organization
			</a>
		{/if}
	</div>
</div>
