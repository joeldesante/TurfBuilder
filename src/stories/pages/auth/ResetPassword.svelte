<script lang="ts">
	import { authClient } from '$lib/client';
	import { goto } from '$app/navigation';
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';

	interface Props {
		token: string;
	}

	let { token }: Props = $props();

	let password = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let error: string | null = $state(null);

	async function onSubmit(event: Event) {
		event.preventDefault();
		error = null;

		if (password !== confirmPassword) {
			error = 'Passwords do not match.';
			return;
		}

		loading = true;

		try {
			const { error: err } = await authClient.resetPassword({ newPassword: password, token });

			if (err) throw new Error(err.message);

			goto('/auth/signin');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex justify-center items-center flex-col gap-6 p-6 min-h-svh">
	{#if !token}
		<div class="w-full max-w-sm gap-4 flex flex-col">
			<h1 class="text-2xl">Invalid reset link</h1>
			<p class="text-sm">This password reset link is missing or invalid.</p>
			<a href="/auth/forgot-password" class="text-sm">Request a new one</a>
		</div>
	{:else}
		<form onsubmit={onSubmit} class="w-full max-w-sm gap-6 flex flex-col">
			<h1 class="text-2xl">Reset password</h1>

			<div class="space-y-3">
				<FormField label="New password">
					<TextInput
						bind:value={password}
						type="password"
						required
						autocomplete="new-password"
					/>
				</FormField>

				<FormField label="Confirm new password">
					<TextInput
						bind:value={confirmPassword}
						type="password"
						required
						autocomplete="new-password"
					/>
				</FormField>
			</div>

			<Button type="submit">
				{loading ? 'Saving…' : 'Reset password'}
			</Button>

			{#if error}
				<p class="text-error">{error}</p>
			{/if}
		</form>
	{/if}
</div>
