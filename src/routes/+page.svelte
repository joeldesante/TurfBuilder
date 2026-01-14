<script lang="ts">
    import { authClient } from "$lib/client";
    import { goto } from "$app/navigation";
	import { onMount } from "svelte";

    let code = $state("");
    let error = $state("");
    let input: HTMLElement;
    const session = authClient.useSession();
    let loading = $state(false);

    $effect(() => {
        loading = !$session.data?.user;
    })

    onMount(() => {
        input?.focus();
    });

    async function loadMap() {

        error = "";

        code = code.toUpperCase();
        if(code.length !== 12) {
            error = "Code must be twelve characters long."
            return;
        }

        let turfRequest = await fetch("/api/turf/resolve", { 
            method: 'POST',
            body: JSON.stringify({ code })
        });

        if(!turfRequest.ok) {
            error = `${await turfRequest.text()}`
            return;
        }

        const response = await turfRequest.json()
        const turfId = response.turfId;
        goto(`/map/${turfId}`);
    }

</script>

<div class="w-screen h-screen flex justify-center items-center flex-col gap-2 wrapper">
    
    <h4 class="text-sm font-bold">ENTER MAP CODE</h4>
    <input
        bind:this={input}
        bind:value={code}
        type="text"
        maxlength="12"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        class="outline-none text-4xl text-center uppercase tracking-widest font-bold w-64 border-b-2"
    />

    <button
        class="bg-blue-600 text-white font-bold text-xs px-4 py-2 rounded-sm cursor-pointer disabled:opacity-50"
        disabled={loading}
        onclick={loadMap}
    >
        {loading ? "LOADING…" : "START CANVASSING"}
    </button>

    {#if error}
        <p class="text-red-600 text-xs mt-2">{error}</p>
    {/if}
</div>

<style>
</style>