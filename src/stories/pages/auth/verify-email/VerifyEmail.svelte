<script lang="ts">
	import { authClient } from '$lib/client';
	import Button from '$components/actions/button/Button.svelte';
	import { ArrowLeftIcon } from 'phosphor-svelte';

	interface Props {
		email: string;
		/**
		 * Opens the organizations page. Given, a plain click runs this instead of following the link,
		 * so the route can cover the page with the loader first. Without it the link just navigates.
		 */
		onBack?: () => void | Promise<void>;
	}

	let { email, onBack }: Props = $props();

	function goBack(event: MouseEvent) {
		// Leave new-tab and other modified clicks to the browser.
		if (!onBack || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		onBack();
	}

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

<div class="relative flex justify-center items-center flex-col gap-6 p-6 min-h-svh">
	<div class="absolute top-4 left-4">
		<Button variant="ghost" href="/orgs" onclick={goBack}>
			<ArrowLeftIcon />
			Organizations
		</Button>
	</div>

	<div class="w-full max-w-sm gap-6 flex flex-col">
		<h1 class="text-2xl">Verify your email</h1>
		<p class="text-sm">
			A verification link was sent to <strong>{email}</strong>. You must verify your email before
			accessing the admin panel.
		</p>

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
