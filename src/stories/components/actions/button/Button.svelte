<script lang="ts">
    let { label, ...props } = $props()
</script>

<button class="px-4 py-2 rounded bg-primary disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed font-medium text-on-primary" {...props}>
    { label }
</button>