<script lang="ts">
    let { value = $bindable(), label = "", ...props } = $props()
</script>

<div class="flex flex-col gap-2">
    {#if label != "" }
        <label for="input">{ label }</label>
    {/if}
    <input class="border border-outline rounded" id="input" bind:value={value} {...props} />
</div>