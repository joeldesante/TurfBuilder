<script lang="ts">
    interface Props {
        codes: string[]
    }

    let { codes } = $props();
</script>

<div>
    <p>Please save backup these codes in a safe place.</p>
    <small>They will be the only way to regain access to your account in the event that your authenticator is lost or stolen.</small>

    <div class="grid grid-cols-2 gap-1 p-2 bg-gray-100 rounded border-1 border-gray-200">
        {#each codes as code }
            <pre>{ code }</pre>
        {/each}
    </div>

</div>