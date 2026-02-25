<script lang="ts">
	import { authClient } from '$lib/client';
	import { goto } from '$app/navigation';
	import Button from '$components/actions/button/Button.svelte';
	import PinInput from '$components/data-inputs/pin-input/PinInput.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';

	const CODE_LENGTH = 6;
	let error = $state('');
	const session = authClient.useSession();
	let loading = $state(false);

	$effect(() => {
		loading = !$session.data?.user;
	});

	async function loadMap(code: string) {
		loading = true;
		error = '';

		try {
			code = code.toUpperCase();
			if (code.length !== CODE_LENGTH) {
				throw new Error(`The code must be ${CODE_LENGTH} characters long.`);
			}

			let turfRequest = await fetch('/api/turf/resolve', {
				method: 'POST',
				body: JSON.stringify({ code })
			});

			if (!turfRequest.ok) {
				throw new Error(await turfRequest.text());
			}

			const response = await turfRequest.json();
			const turfId = response.turfId;
			await goto(`/map/${turfId}`);
		} catch (e: Error | any) {
			error = e.message;
		} finally {
			loading = false;
		}
	}

	async function logout() {
		await authClient.signOut();
		location.href = '/auth/signin/';
	}
</script>

<div class="flex justify-center items-center flex-col gap-6 p-6 min-h-svh">
	<h1 class="text-xl">Enter map code</h1>

	{#if loading == true}
		<p>Loading...</p>
		<!-- Replace me with a spinner! -->
	{:else}
		<FormField label="Map code" labelVisibility="sr-only">
			<PinInput maxlength={CODE_LENGTH} onComplete={loadMap} autofocus={true} />
		</FormField>
	{/if}

	{#if error}
		<p class="text-error">{error}</p>
	{/if}

	{#if $session.data?.user.role === 'admin' || $session.data?.user.role === 'campaignManager' || $session.data?.user.role === 'fieldOrganizer'}
		<a class="hidden sm:block" href="/system">Admin dashboard</a>
	{/if}

	<Button onclick={logout}>Sign Out</Button>
</div>

<style>
</style>
