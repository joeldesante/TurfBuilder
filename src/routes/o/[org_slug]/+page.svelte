<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';

	const { data } = $props();
</script>

<Button
	href="/orgs"
	variant="ghost"
	size="sm"
	class="absolute left-4 top-4 gap-1"
>
	<ArrowLeftIcon size={14} />
	Organizations
</Button>

<div class="flex h-dvh items-center justify-center">
	<div class="text-center space-y-4">
		<h1 class="text-3xl font-bold">{data.organization?.name}</h1>
		<p class="text-secondary">You're about to start canvassing</p>
		<Button
			href="/o/{data.organization?.slug}/join"
			class="inline-block mt-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors"
		>
			Begin Canvassing
		</Button>
	</div>
</div>
