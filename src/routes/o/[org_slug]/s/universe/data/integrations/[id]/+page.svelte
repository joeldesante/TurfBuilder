<script lang="ts">
	const { data } = $props();
</script>

<div class="px-6 py-6">
	<div class="flex items-center gap-4 mb-6">
		<div class="size-14 shrink-0 rounded-xl border border-outline-subtle bg-surface flex items-center justify-center overflow-hidden">
			<img src={data.integration.logoUrl} alt="{data.integration.name} logo" class="size-10 object-contain" />
		</div>
		<div>
			<h1 class="text-xl font-semibold text-on-surface">{data.integration.name}</h1>
			<p class="text-sm text-on-surface-subtle">{data.integration.description}</p>
		</div>
	</div>

	<p class="text-sm text-on-surface-subtle">No configuration available yet.</p>
</div>
