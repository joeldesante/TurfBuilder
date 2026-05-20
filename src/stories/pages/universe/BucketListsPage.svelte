<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';

	interface Props {
		bucketName: string;
	}

	const { bucketName }: Props = $props();
</script>

<PageHeader title="Lists" subheading={bucketName} />
