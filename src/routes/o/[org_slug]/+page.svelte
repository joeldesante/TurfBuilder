<script lang="ts">
	const { data } = $props();
</script>

<div class="flex h-dvh items-center justify-center">
	<div class="text-center space-y-4">
		<h1 class="text-2xl font-semibold">{data.organization?.name}</h1>
		<p class="text-secondary">Welcome. Your canvassing turf code will be shared with you by your organizer.</p>
		<a
			href="/o/{data.organization?.slug}/join"
			class="inline-block mt-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors"
		>
			Join a Turf
		</a>
	</div>
</div>
