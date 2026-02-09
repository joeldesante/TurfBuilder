<script lang="ts">
    import { authClient } from "$lib/client";
    import { goto } from "$app/navigation";
	import { onMount } from "svelte";
	import Pin from "$components/data-inputs/pin/Pin.svelte";

    const CODE_LENGTH = 6;
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

    async function loadMap(code: string) {
        loading = true;
        error = "";

        try {
            code = code.toUpperCase();
            if(code.length !== CODE_LENGTH) {
                throw new Error(`The code must be ${CODE_LENGTH} characters long.`);
            }

            let turfRequest = await fetch("/api/turf/resolve", { 
                method: 'POST',
                body: JSON.stringify({ code })
            });

            if(!turfRequest.ok) {
                throw new Error(await turfRequest.text());
            }

            const response = await turfRequest.json()
            const turfId = response.turfId;
            goto(`/map/${turfId}`);
        } catch(e: Error | any) {
            error = e.message;
        } finally {
            loading = false;
        }
    }

</script>

<div class="w-screen h-screen flex justify-center items-center flex-col gap-2 wrapper">
    
    <h4 class="text-sm font-bold">ENTER MAP CODE</h4>

    {#if loading == true }
        <p>Loading...</p> <!-- Replace me with a spinner! -->
    {:else}
        <Pin length={CODE_LENGTH} onPinEntered={loadMap} />
    {/if}

    {#if error}
        <p class="text-error text-xs mt-2">{error}</p>
    {/if}

    {#if $session.data?.user.role === 'admin'}
    <a href="/system">Admin dashboard</a>
    {/if}
</div>

<style>
</style>