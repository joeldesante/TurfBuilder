<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';

	interface Org {
		id: string;
		name: string;
		slug: string;
	}

	interface Props {
		orgs: Org[];
		onSelect: (org: Org) => void;
	}

	const { orgs, onSelect }: Props = $props();
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

		<a href="/orgs/create" class="text-sm text-center text-muted hover:underline mt-2">
			Create a new organization
		</a>
	</div>
</div>
