<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Button from '$components/actions/button/Button.svelte';
	import { authClient } from '$lib/client';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';

	const { data } = $props();

	const redirectTo = $derived($page.url.searchParams.get('redirectTo') ?? '/');
	const signupHref = $derived(
		redirectTo !== '/'
			? `/auth/signup?redirectTo=${encodeURIComponent(redirectTo)}`
			: '/auth/signup'
	);

	let username = $state('');
	let password = $state('');
	let rememberMe = $state(false);
	let loading = $state(false);
	let anonLoading = $state(false);
	let error: string | null = $state('');

	async function signIn(event: Event) {
		event.preventDefault();

		loading = true;
		error = null;

		try {
			let response = await authClient.signIn.username({
				username,
				password,
				rememberMe
			});

			if (response.error) {
				throw new Error(response.error.message);
			}

			goto(redirectTo);
		} catch (e) {
			if (e instanceof Error) {
				error = e.message;
			} else {
				error = 'Unkknown error.';
			}
			console.warn(e);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign In | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<div class="flex justify-center items-center flex-col gap-6 p-6 min-h-svh">
	<form onsubmit={signIn} class="w-full max-w-sm gap-6 flex flex-col">
		<h1 class="text-2xl">Sign In</h1>

		<div class="space-y-3">
			<FormField label="Username" id="username">
				<TextInput bind:value={username} required autocomplete="username" />
			</FormField>

			<FormField label="Password" id="password">
				<TextInput bind:value={password} type="password" required autocomplete="current-password" />
			</FormField>
		</div>

		<FormField label="Remember me" labelVisibility="sr-only">
			<Checkbox bind:checked={rememberMe}>Remember me</Checkbox>
		</FormField>

		<Button type="submit">
			{loading ? 'Signing in…' : 'Sign In'}
		</Button>

		{#if error}
			<p class="text-error">{error}</p>
		{/if}
	</form>

	<div class="text-center">
		<p class="text-sm">Don't have an account? <a href={signupHref}>Sign up</a></p>
	</div>
</div>
