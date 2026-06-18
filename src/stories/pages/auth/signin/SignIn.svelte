<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import AuthLayout from '$components/layout/auth-layout/AuthLayout.svelte';
	import { authClient } from '$lib/client';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { z } from 'zod';

	interface Props {
		redirectTo?: string;
	}

	let { redirectTo = '/' }: Props = $props();

	const signupHref = $derived(
		redirectTo !== '/'
			? `/auth/signup?redirectTo=${encodeURIComponent(redirectTo)}`
			: '/auth/signup'
	);

	const schema = z.object({
		identifier: z.string().min(1, 'Email or username is required'),
		password: z.string().min(1, 'Password is required')
	});

	const form = new Form(schema, async (values) => {
		const isEmail = values.identifier.includes('@');
		let response;

		if (isEmail) {
			response = await authClient.signIn.email({
				email: values.identifier,
				password: values.password,
				rememberMe: true
			});
		} else {
			response = await authClient.signIn.username({
				username: values.identifier,
				password: values.password,
				rememberMe: true
			});
		}

		if (response.error) {
			throw new Error(response.error.message);
		}

		goto(redirectTo);
	});
</script>

<AuthLayout>
	{#snippet children()}
		<form
			onsubmit={(e) => { e.preventDefault(); form.submit(); }}
			class="w-full max-w-sm gap-6 flex flex-col"
		>
			<div class="space-y-3">
				<FormField
					label="Email or Username"
					id="identifier"
					errors={form.touched.identifier ? (form.errors.identifier ?? []) : []}
					dirty={form.touched.identifier}
				>
					<TextInput
						bind:value={form.values.identifier}
						autocomplete="username"
						onfocusout={() => form.touch('identifier')}
					/>
				</FormField>

				<FormField
					label="Password"
					id="password"
					errors={form.touched.password ? (form.errors.password ?? []) : []}
					dirty={form.touched.password}
				>
					{#snippet labelAction()}
						<a href="/auth/forgot-password" class="text-sm text-primary"> Forgot password? </a>
					{/snippet}
					<TextInput
						bind:value={form.values.password}
						type="password"
						autocomplete="current-password"
						onfocusout={() => form.touch('password')}
					/>
				</FormField>
			</div>

			<Button type="submit" loading={form.submitting}>
				{form.submitting ? 'Signing in…' : 'Sign In'}
			</Button>

			{#if form.errorMessage}
				<p class="text-error">{form.errorMessage}</p>
			{/if}
		</form>
	{/snippet}
	{#snippet footer()}
		<p class="text-sm">Don't have an account? <a href={signupHref}>Sign up</a></p>
	{/snippet}
</AuthLayout>
