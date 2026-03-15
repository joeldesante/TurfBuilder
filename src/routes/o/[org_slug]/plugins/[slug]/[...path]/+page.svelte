<script lang="ts">
	const { data } = $props();
	const { PageComponent, ...pageProps } = data;
</script>

<svelte:component this={PageComponent} {...pageProps} />
