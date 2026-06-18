<script lang="ts">
	import { authClient } from '$lib/client';
	import Button from '$components/actions/button/Button.svelte';

	interface Props {
		email: string;
	}

	let { email }: Props = $props();

	const DEBOUNCE_SECONDS = 25;

	let loading = $state(false);
	let errorMessage = $state('');
	let cooldown = $state(0);

	let interval: ReturnType<typeof setInterval> | null = null;

	function startCooldown() {
		cooldown = DEBOUNCE_SECONDS;
		interval = setInterval(() => {
			cooldown -= 1;
			if (cooldown <= 0) {
				cooldown = 0;
				clearInterval(interval!);
				interval = null;
			}
		}, 1000);
	}

	async function resend() {
		if (cooldown > 0 || loading) return;
		loading = true;
		errorMessage = '';
		try {
			const { error } = await authClient.sendVerificationEmail({
				email,
				callbackURL: '/'
			});
			if (error) throw new Error(error.message);
			startCooldown();
		} catch (e: any) {
			errorMessage = e.message;
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex justify-center items-center flex-col gap-6 p-6 min-h-svh">
	<div class="w-full max-w-sm gap-6 flex flex-col">
		<h1 class="text-2xl">Verify your email</h1>
		<p class="text-sm">
			A verification link was sent to <strong>{email}</strong>. You must verify your email before
			accessing the admin panel.
		</p>
		<p class="text-sm">You can still use volunteer features in the meantime.</p>

		<Button onclick={resend} disabled={cooldown > 0 || loading}>
			{#if loading}
				Sending…
			{:else if cooldown > 0}
				Resend verification email ({cooldown}s)
			{:else}
				Resend verification email
			{/if}
		</Button>

		{#if errorMessage}
			<p class="text-error">{errorMessage}</p>
		{/if}
	</div>
</div>
