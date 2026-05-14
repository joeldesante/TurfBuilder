<script lang="ts">
	import { authClient } from '$lib/client';
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';

	let email = $state('');
	let errorMessage = $state('');
	let submitted = $state(false);
	let loading = $state(false);

	async function onSubmit(event: Event) {
		event.preventDefault();
		loading = true;
		errorMessage = '';

		try {
			const { error } = await authClient.changeEmail({
				newEmail: email,
				callbackURL: '/auth/signin'
			});

			if (error) {
				throw new Error(error.message);
			}

			submitted = true;
		} catch (e: any) {
			errorMessage = e.message;
		} finally {
			loading = false;
		}
	}

	function tryAgain() {
		submitted = false;
		errorMessage = '';
	}
</script>

<div class="flex justify-center items-center flex-col gap-6 p-6 min-h-svh">
	{#if submitted}
		<div class="w-full max-w-sm gap-6 flex flex-col">
			<h1 class="text-2xl">Check your inbox</h1>
			<p class="text-sm">
				A verification link has been sent to <strong>{email}</strong>. Click it to confirm your
				email address and gain full access.
			</p>
			<p class="text-sm">Wrong address? <button class="underline" onclick={tryAgain}>Enter a different email</button></p>
		</div>
	{:else}
		<form onsubmit={onSubmit} class="w-full max-w-sm gap-6 flex flex-col">
			<h1 class="text-2xl">Set your email address</h1>
			<p class="text-sm">
				Your account was created without a real email address. Please provide one to continue.
			</p>

			<FormField label="Email">
				<TextInput bind:value={email} type="email" required autocomplete="email" />
			</FormField>

			<Button type="submit">
				{loading ? 'Sending…' : 'Send verification email'}
			</Button>

			{#if errorMessage}
				<p class="text-error">{errorMessage}</p>
			{/if}
		</form>
	{/if}
</div>
