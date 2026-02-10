<script lang="ts">
	import type { FormValidationError } from "$lib/client/formstorm/form.svelte";

    interface Props {
        value: any,
        label: string,
        errors: string[],
        dirty: boolean
        [key: string]: any;
    }

    let { value = $bindable(), label = "", errors = [], dirty = false, ...props }: Props = $props()
</script>

<div class="flex flex-col gap-2">
    {#if label != "" }
        <label for="input">{ label }</label>
    {/if}
    <input class="border border-outline rounded" id="input" bind:value={value} {...props} />
    <div>
        <small class="text-red-500">
            {#if errors.length > 0 && dirty }
                { errors[0] }
            {/if}
            &nbsp;
        </small>
    </div>
</div>