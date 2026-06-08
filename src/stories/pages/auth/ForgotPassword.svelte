<script lang="ts">
	import { authClient } from '$lib/client';
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';

	let email = $state('');
	let loading = $state(false);
	let error: string | null = $state(null);
	let submitted = $state(false);

	async function onSubmit(event: Event) {
		event.preventDefault();
		loading = true;
		error = null;

		try {
			const { error: err } = await authClient.requestPasswordReset({
				email,
				redirectTo: '/auth/reset-password'
			});

			if (err) throw new Error(err.message);

			submitted = true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex justify-center items-center flex-col gap-6 p-6 min-h-svh">
	{#if submitted}
		<div class="w-full max-w-sm gap-4 flex flex-col">
			<h1 class="text-2xl">Check your email</h1>
			<p class="text-sm">
				If an account exists for <strong>{email}</strong>, you will receive a password reset link
				shortly.
			</p>
			<a href="/auth/signin" class="text-sm">Back to sign in</a>
		</div>
	{:else}
		<form onsubmit={onSubmit} class="w-full max-w-sm gap-6 flex flex-col">
			<div class="gap-1 flex flex-col">
				<h1 class="text-2xl">Forgot password</h1>
				<p class="text-sm">Enter your email and we'll send you a reset link.</p>
			</div>

			<FormField label="Email">
				<TextInput bind:value={email} type="email" required autocomplete="email" />
			</FormField>

			<Button type="submit">
				{loading ? 'Sending…' : 'Send reset link'}
			</Button>

			{#if error}
				<p class="text-error">{error}</p>
			{/if}
		</form>

		<div class="text-center">
			<p class="text-sm"><a href="/auth/signin">Back to sign in</a></p>
		</div>
	{/if}
</div>
