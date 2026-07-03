<script lang="ts">
	import { authClient } from '$lib/client';
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import AuthLayout from '$components/layout/layouts/auth-layout/AuthLayout.svelte';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { z } from 'zod';
	import { CheckCircleIcon, CircleIcon } from 'phosphor-svelte';

	interface Props {
		onComplete?: (email: string, password: string) => Promise<void>;
		signinHref?: string;
	}

	let {
		onComplete = async (_email: string, _password: string) => {},
		signinHref = '/auth/signin'
	}: Props = $props();

	const schema = z
		.object({
			email: z.string().email('A valid email is required'),
			username: z.string().min(1, 'Username is required'),
			password: z
				.string()
				.min(8, 'Password must be at least 8 characters')
				.regex(/[A-Z]/, 'Password must contain at least one capital letter')
				.regex(
					/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
					'Password must contain a number or special character'
				),
			confirmPassword: z.string()
		})
		.refine((v) => v.password === v.confirmPassword, {
			message: 'Passwords do not match',
			path: ['confirmPassword']
		});

	const form = new Form(schema, async (values) => {
		const { error } = await authClient.signUp.email({
			email: values.email,
			name: values.username,
			username: values.username,
			password: values.password
		});

		if (error) throw new Error(error.message);

		await onComplete(values.email, values.password);
	});

	const passwordRules = $derived([
		{ label: 'At least 8 characters', met: form.values.password.length >= 8 },
		{ label: 'At least one capital letter', met: /[A-Z]/.test(form.values.password) },
		{
			label: 'At least one number or special character',
			met: /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(form.values.password)
		}
	]);
</script>

<AuthLayout>
	{#snippet children()}
		<form
			onsubmit={(e) => {
				e.preventDefault();
				form.submit();
			}}
			autocomplete="off"
			class="w-full max-w-sm gap-6 flex flex-col"
		>
			<div class="space-y-3">
				<FormField
					label="Email"
					errors={form.touched.email ? (form.errors.email ?? []) : []}
					dirty={form.touched.email}
				>
					{#snippet helperContent()}
						Want to keep your identity private? Use a <a target="_blank" href="https://proton.me"
							>Proton Mail</a
						> address.
					{/snippet}
					<TextInput
						bind:value={form.values.email}
						type="email"
						autocomplete="off"
						onfocusout={() => form.touch('email')}
					/>
				</FormField>

				<FormField
					label="Username"
					errors={form.touched.username ? (form.errors.username ?? []) : []}
					dirty={form.touched.username}
				>
					<TextInput
						bind:value={form.values.username}
						autocomplete="off"
						onfocusout={() => form.touch('username')}
					/>
				</FormField>

				<FormField
					label="Password"
					errors={form.touched.password ? (form.errors.password ?? []) : []}
					dirty={form.touched.password}
				>
					<TextInput
						type="password"
						bind:value={form.values.password}
						autocomplete="off"
						onfocusout={() => form.touch('password')}
					/>
				</FormField>

				{#if form.values.password.length > 0}
					<div class="bg-surface-container rounded-lg p-3 flex flex-col gap-1.5">
						<p class="text-xs font-medium text-on-surface">Password requirements</p>
						{#each passwordRules as rule}
							<div
								class={[
									'flex items-center gap-1.5 text-xs',
									rule.met ? 'text-success' : 'text-on-surface-subtle'
								].join(' ')}
							>
								{#if rule.met}
									<CheckCircleIcon size={14} weight="fill" />
								{:else}
									<CircleIcon size={14} />
								{/if}
								{rule.label}
							</div>
						{/each}
					</div>
				{/if}

				<FormField
					label="Confirm Password"
					errors={form.touched.confirmPassword ? (form.errors.confirmPassword ?? []) : []}
					dirty={form.touched.confirmPassword}
				>
					<TextInput
						type="password"
						bind:value={form.values.confirmPassword}
						autocomplete="off"
						onfocusout={() => form.touch('confirmPassword')}
					/>
				</FormField>
			</div>

			<Button type="submit" loading={form.submitting}>
				{form.submitting ? 'Signing up…' : 'Sign Up'}
			</Button>

			{#if form.errorMessage}
				<p class="text-error">{form.errorMessage}</p>
			{/if}
		</form>
	{/snippet}
	{#snippet footer()}
		<p class="text-sm">Already have an account? <a href={signinHref}>Sign in</a></p>
	{/snippet}
</AuthLayout>
