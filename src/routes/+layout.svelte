<script lang="ts">
    import '../app.css';
    
    import { pwaInfo } from 'virtual:pwa-info';
    import { pwaAssetsHead } from 'virtual:pwa-assets/head';
    
    let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');
    let { children, data } = $props();
</script>

<svelte:head>
    <title>{ data.config.application_name }</title>

    {#if pwaAssetsHead.themeColor}
        <meta name="theme-color" content={pwaAssetsHead.themeColor.content} />
    {/if}

    {#each pwaAssetsHead.links as link}
        <link {...link} />
    {/each}

    {@html webManifestLink}
</svelte:head>

{@render children()}