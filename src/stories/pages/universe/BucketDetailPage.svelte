<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';

	interface Props {
		name: string;
		description?: string;
	}

	const { name, description }: Props = $props();
</script>

<PageHeader title={name} subheading={description} />
