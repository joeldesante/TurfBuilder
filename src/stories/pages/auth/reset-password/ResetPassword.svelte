<script lang="ts">
	import { authClient } from '$lib/client';
	import { goto } from '$app/navigation';
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import AuthLayout from '$components/layout/layouts/auth-layout/AuthLayout.svelte';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { z } from 'zod';

	interface Props {
		token: string;
	}

	let { token }: Props = $props();

	const schema = z
		.object({
			password: z.string().min(8, 'Password must be at least 8 characters'),
			confirmPassword: z.string()
		})
		.refine((v) => v.password === v.confirmPassword, {
			message: 'Passwords do not match',
			path: ['confirmPassword']
		});

	const form = new Form(schema, async (values) => {
		const { error } = await authClient.resetPassword({ newPassword: values.password, token });

		if (error) throw new Error(error.message);

		goto('/auth/signin');
	});
</script>

<AuthLayout showLogo={false} title="Reset password">
	{#snippet children()}
		{#if !token}
			<div class="w-full max-w-sm gap-4 flex flex-col">
				<h1 class="text-2xl">Invalid reset link</h1>
				<p class="text-sm">This password reset link is missing or invalid.</p>
				<Button href="/auth/forgot-password">Request a new one</Button>
			</div>
		{:else}
			<form
				onsubmit={(e) => {
					e.preventDefault();
					form.submit();
				}}
				class="w-full max-w-sm gap-6 flex flex-col"
			>
				<div class="space-y-3">
					<FormField
						label="New password"
						errors={form.touched.password ? (form.errors.password ?? []) : []}
						dirty={form.touched.password}
					>
						<TextInput
							bind:value={form.values.password}
							type="password"
							autocomplete="new-password"
							onfocusout={() => form.touch('password')}
						/>
					</FormField>

					<FormField
						label="Confirm new password"
						errors={form.touched.confirmPassword ? (form.errors.confirmPassword ?? []) : []}
						dirty={form.touched.confirmPassword}
					>
						<TextInput
							bind:value={form.values.confirmPassword}
							type="password"
							autocomplete="new-password"
							onfocusout={() => form.touch('confirmPassword')}
						/>
					</FormField>
				</div>

				<Button type="submit" loading={form.submitting}>
					{form.submitting ? 'Saving…' : 'Reset password'}
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
