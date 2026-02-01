<script lang="ts">
    let { label, ...props } = $props()
</script>

<button class="px-4 py-2 rounded bg-green-600 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed font-medium text-white border-1 border-green-700" {...props}>
    { label }
</button>