<script lang="ts">
	import PinInput from '$components/data-inputs/pin-input/PinInput.svelte';

	interface Props {
		onJoin: (code: string) => Promise<void>;
	}

	const { onJoin }: Props = $props();

	let loading = $state(false);
	let error = $state<string | null>(null);

	async function handleComplete(code: string) {
		loading = true;
		error = null;

		try {
			await onJoin(code.toUpperCase());
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-dvh flex items-center justify-center bg-surface p-4">
	<div class="w-full max-w-sm space-y-6">
		<div class="text-center space-y-1">
			<h1 class="text-2xl font-semibold">Join a Turf</h1>
			<p class="text-on-surface-subtle text-sm">
				Enter your 6-character turf code to begin canvassing.
			</p>
		</div>

		<div class="flex flex-col items-center space-y-4">
			<PinInput
				maxlength={6}
				onComplete={handleComplete}
				disabled={loading}
				autofocus
			/>

			{#if loading}
				<p class="text-on-surface-subtle text-sm">Looking up...</p>
			{/if}

			{#if error}
				<p class="text-error text-sm text-center">{error}</p>
			{/if}
		</div>
	</div>
</div>
