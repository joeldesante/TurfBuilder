<script lang="ts">
	import { authClient } from '$lib/client';
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import AuthLayout from '$components/layout/layouts/auth-layout/AuthLayout.svelte';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { z } from 'zod';

	const schema = z.object({
		email: z.string().email('A valid email is required')
	});

	let submitted = $state(false);

	const form = new Form(schema, async (values) => {
		const { error } = await authClient.changeEmail({
			newEmail: values.email,
			callbackURL: '/auth/signin'
		});

		if (error) throw new Error(error.message);

		submitted = true;
	});

	function tryAgain() {
		submitted = false;
		form.reset();
	}
</script>

<AuthLayout showLogo={false}>
	{#snippet children()}
		{#if submitted}
			<div class="w-full max-w-sm gap-6 flex flex-col">
				<h1 class="text-2xl">Check your inbox</h1>
				<p class="text-sm">
					A verification link has been sent to <strong>{form.values.email}</strong>. Click it to
					confirm your email address and gain full access.
				</p>
				<p class="text-sm">
					Wrong address? <button class="underline" onclick={tryAgain}
						>Enter a different email</button
					>
				</p>
			</div>
		{:else}
			<form
				onsubmit={(e) => {
					e.preventDefault();
					form.submit();
				}}
				class="w-full max-w-sm gap-6 flex flex-col"
			>
				<h1 class="text-2xl">Set your email address</h1>
				<p class="text-sm">
					Your account was created without a real email address. Please provide one to continue.
				</p>

				<FormField
					label="Email"
					errors={form.touched.email ? (form.errors.email ?? []) : []}
					dirty={form.touched.email}
				>
					<TextInput
						bind:value={form.values.email}
						type="email"
						autocomplete="email"
						onfocusout={() => form.touch('email')}
					/>
				</FormField>

				<Button type="submit" loading={form.submitting}>
					{form.submitting ? 'Sending…' : 'Send verification email'}
				</Button>

				{#if form.errorMessage}
					<p class="text-error">{form.errorMessage}</p>
				{/if}
			</form>
		{/if}
	{/snippet}
</AuthLayout>
