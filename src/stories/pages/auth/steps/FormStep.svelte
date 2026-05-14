<script lang="ts">
	import { authClient } from '$lib/client';
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';

	interface Props {
		onComplete: (email: string, password: string) => Promise<void>;
	}

	let { onComplete = async (_email: string, _password: string) => {} }: Props = $props();

	let email = $state('');
	let username = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let errorMessage = $state('');

	async function onSubmit() {
		try {
			if (password !== confirmPassword) {
				throw new Error('Passwords do not match.');
			}

			const { error } = await authClient.signUp.email({
				email,
				name: username,
				username,
				password
			});

			if (error) {
				throw new Error(error.message);
			}

			onComplete(email, password);
		} catch (e: any) {
			errorMessage = e.message;
		}
	}
</script>

<div class="p-6 gap-6 flex justify-center items-center flex-col min-h-svh">
	<form class="w-full max-w-sm gap-6 flex flex-col">
		<h1 class="text-2xl">Sign Up</h1>

		<div class="space-y-3">
			<FormField label="Email">
				<TextInput bind:value={email} type="email" required autocomplete="email" />
			</FormField>

			<FormField label="Username">
				<TextInput bind:value={username} required autocomplete="username" />
			</FormField>

			<FormField label="Password">
				<TextInput type="password" bind:value={password} required autocomplete="new-password" />
			</FormField>

			<FormField label="Confirm Password">
				<TextInput
					type="password"
					bind:value={confirmPassword}
					required
					autocomplete="new-password"
				/>
			</FormField>
		</div>

		<Button onclick={onSubmit}>Sign Up</Button>

		{#if errorMessage}
			<p class="text-error">{errorMessage}</p>
		{/if}
	</form>
	<div class="text-center">
		<p class="text-sm">Already have an account? <a href="/auth/signin">Sign in</a></p>
	</div>
</div>
