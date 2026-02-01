<script lang="ts">
    let { value = $bindable(), label = "", ...props } = $props()
</script>

<div class="flex flex-col gap-2">
    {#if label != "" }
        <label for="input">{ label }</label>
    {/if}
    <input class="border-1 border-gray-500 rounded" id="input" bind:value={value} {...props} />
</div>