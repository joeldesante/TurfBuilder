<script lang="ts">
    import '../app.css';
    import { CubeIcon } from "phosphor-svelte";

    let { children, data } = $props();
</script>

<svelte:head>
    <title>{ data.config.application_name }</title>

    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content={data.config.application_name}>
    <link rel="apple-touch-icon" href={"/turf_builder_app_icon.png"}>
</svelte:head>


{#if process.env.NODE_ENV?.toLowerCase() !== "production" }
    <div title="This instance is not runnning in production mode!" class="absolute bottom-0 right-0 rounded-full bg-orange-500 font-bold text-xs p-1 px-2 m-1 flex flex-row gap-1 items-center select-none shadow z-50">
        <CubeIcon weight="fill" />
        DEV
    </div>
{/if}

{@render children()}