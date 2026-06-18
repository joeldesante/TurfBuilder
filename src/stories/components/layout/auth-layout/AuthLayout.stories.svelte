<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AuthLayout from './AuthLayout.svelte';

	const { Story } = defineMeta({
		title: 'Components/Layout/Auth Layout',
		component: AuthLayout,
		tags: ['autodocs'],
		parameters: {
			docs: {
				subtitle:
					'Full-screen centered layout for authentication pages. Renders the logo, a main content area, and an optional footer link row.'
			},
			layout: 'fullscreen'
		}
	});
</script>

<Story name="Default" asChild>
	<AuthLayout>
		{#snippet children()}
			<form class="w-full max-w-sm gap-6 flex flex-col">
				<p class="text-sm">Form content goes here.</p>
			</form>
		{/snippet}
	</AuthLayout>
</Story>

<Story name="With Footer" asChild>
	<AuthLayout>
		{#snippet children()}
			<form class="w-full max-w-sm gap-6 flex flex-col">
				<p class="text-sm">Form content goes here.</p>
			</form>
		{/snippet}
		{#snippet footer()}
			<p class="text-sm">Don't have an account? <a href="/auth/signup">Sign up</a></p>
		{/snippet}
	</AuthLayout>
</Story>
