<script lang="ts">
    let { label, ...props } = $props()
</script>

<button class="px-4 py-2 rounded bg-green-600 cursor-pointer font-medium text-white border-1 border-green-700" {...props}>
    { label }
</button>