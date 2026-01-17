<script lang="ts">
    import '../app.css';
    import favicon from '$lib/assets/favicon.svg';
    
    //@ts-ignore
    import { pwaInfo } from 'virtual:pwa-info';
    
    let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');
    let { children, data } = $props();
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <title>{ data.config.application_name }</title>
    {@html webManifestLink}
</svelte:head>

{@render children()}