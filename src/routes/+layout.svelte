<script lang="ts">
    import './layout.css';
    import favicon from '$lib/assets/favicon.svg';
    import { pwaInfo } from 'virtual:pwa-info';
    
    let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');
    
    let { children } = $props();
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    {@html webManifestLink}
</svelte:head>

{@render children()}