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
		const { error } = await authClient.requestPasswordReset({
			email: values.email,
			redirectTo: '/auth/reset-password'
		});

		if (error) throw new Error(error.message);

		submitted = true;
	});
</script>

<AuthLayout showLogo={false} title="Forgot password">
	{#snippet children()}
		{#if submitted}
			<div class="w-full max-w-sm gap-4 flex flex-col">
				<h1 class="text-2xl">Check your email</h1>
				<p class="text-sm">
					If an account exists for <strong>{form.values.email}</strong>, you will receive a password
					reset link shortly.
				</p>
				<a href="/auth/signin" class="text-sm">Back to sign in</a>
			</div>
		{:else}
			<form
				onsubmit={(e) => {
					e.preventDefault();
					form.submit();
				}}
				class="w-full max-w-sm gap-6 flex flex-col"
			>
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
					{form.submitting ? 'Sending…' : 'Send reset link'}
				</Button>

				{#if form.errorMessage}
					<p class="text-error">{form.errorMessage}</p>
				{/if}
			</form>
		{/if}
	{/snippet}
	{#snippet footer()}
		<p class="text-sm"><a href="/auth/signin">Back to sign in</a></p>
	{/snippet}
</AuthLayout>
