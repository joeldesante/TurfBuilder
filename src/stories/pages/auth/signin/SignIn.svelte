<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import AuthLayout from '$components/layout/layouts/auth-layout/AuthLayout.svelte';
	import { authClient } from '$lib/client';
	import { navigateWithLoader } from '$lib/client/navigate-with-loader';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { z } from 'zod';

	interface Props {
		redirectTo?: string;
	}

	let { redirectTo = '/orgs' }: Props = $props();

	const signupHref = $derived(
		redirectTo !== '/orgs'
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

		// Two-factor accounts are not signed in yet: better-auth asks for a code first.
		if ((response.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
			needsCode = true;
			return;
		}

		// Cover the page now, before the redirect, so the next page loads in under the fade.
		await navigateWithLoader(redirectTo);
	});

	/** Set once the password is right for an account with two-factor on. */
	let needsCode = $state(false);
	/** A backup code instead of the authenticator app's. */
	let useBackupCode = $state(false);

	const codeSchema = z.object({
		code: z.string().trim().min(1, 'Enter the code')
	});

	const codeForm = new Form(codeSchema, async ({ code }) => {
		const { error } = useBackupCode
			? await authClient.twoFactor.verifyBackupCode({ code })
			: await authClient.twoFactor.verifyTotp({ code });
		if (error) throw new Error(error.message ?? 'That code did not work. Try again.');

		await navigateWithLoader(redirectTo);
	});

	function switchCode() {
		useBackupCode = !useBackupCode;
		codeForm.reset();
	}
</script>

<AuthLayout>
	{#snippet children()}
		{#if needsCode}
			<form
				onsubmit={(e) => {
					e.preventDefault();
					codeForm.submit();
				}}
				class="w-full max-w-sm gap-6 flex flex-col"
			>
				<div class="space-y-2">
					<h1 class="text-2xl">Two-factor authentication</h1>
					<p class="text-sm">
						{useBackupCode
							? 'Enter one of the backup codes you saved when you turned on two-factor.'
							: 'Enter the 6-digit code from your authenticator app.'}
					</p>
				</div>

				<FormField
					label={useBackupCode ? 'Backup code' : 'Authentication code'}
					id="code"
					errors={codeForm.touched.code ? (codeForm.errors.code ?? []) : []}
					dirty={codeForm.touched.code}
				>
					<TextInput
						bind:value={codeForm.values.code}
						autocomplete="one-time-code"
						inputmode={useBackupCode ? 'text' : 'numeric'}
						onfocusout={() => codeForm.touch('code')}
					/>
				</FormField>

				<Button type="submit" loading={codeForm.submitting}>
					{codeForm.submitting ? 'Verifying…' : 'Verify'}
				</Button>

				<!-- Always rendered: the message clears when the field loses focus, and a
				     collapsing line would move the centered form under the pointer, losing the click. -->
				<p class="text-error min-h-6" aria-live="polite">{codeForm.errorMessage}</p>

				<button type="button" class="text-sm text-primary self-start" onclick={switchCode}>
					{useBackupCode ? 'Use your authenticator app instead' : 'Use a backup code instead'}
				</button>
			</form>
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

				<!-- Always rendered, so clearing it on focusout does not move the button mid-click. -->
				<p class="text-error min-h-6" aria-live="polite">{form.errorMessage}</p>
			</form>
		{/if}
	{/snippet}
	{#snippet footer()}
		<p class="text-sm">Don't have an account? <a href={signupHref}>Sign up</a></p>
	{/snippet}
</AuthLayout>
