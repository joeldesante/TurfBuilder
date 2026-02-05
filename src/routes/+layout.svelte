<script lang="ts">
    import '../app.css';
    
    import { pwaInfo } from 'virtual:pwa-info';
    import { pwaAssetsHead } from 'virtual:pwa-assets/head';
    import { CubeIcon } from "phosphor-svelte";
    
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


{#if process.env.NODE_ENV?.toLowerCase() !== "production" }
    <div title="This instance is not runnning in production mode!" class="absolute bottom-0 right-0 rounded-full bg-orange-500 font-bold text-xs p-1 px-2 m-1 flex flex-row gap-1 items-center select-none shadow z-50">
        <CubeIcon weight="fill" />
        DEV
    </div>
{/if}

{@render children()}