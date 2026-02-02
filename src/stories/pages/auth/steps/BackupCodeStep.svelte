<script lang="ts">
	import { goto } from "$app/navigation";
	import Button from "$components/actions/button/Button.svelte";

    interface Props {
        codes: string[]
    }

    let { codes } = $props();
    let confirm = $state(false);
</script>

<div class="p-4 flex flex-col gap-4">
    <div>
        <p class="text-md font-medium">Please save backup these codes in a safe place.</p>
        <small>They will be the only way to regain access to your account in the event that your authenticator is lost or stolen.</small>
    </div>
    
    <div class="grid grid-cols-2 gap-1 p-2 bg-gray-100 rounded border border-gray-200">
        {#each codes as code }
            <pre>{ code }</pre>
        {/each}
    </div>

    <div class="flex flex-col gap-2 p-4 bg-gray-200 rounded border border-gray-400">
        <label>
            <input type="checkbox" bind:checked={confirm} />
            I verify that I have saved these backup codes in a secure and memorable location.
        </label>
        <Button label="Confirm" disabled={!confirm} onclick={() => goto("/")} />
    </div>

</div>