<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import UserMenu from '$components/actions/user-menu/UserMenu.svelte';
	import { ArrowLeftIcon } from 'phosphor-svelte';

	interface Props {
		/** Where the back button goes. */
		backHref?: string;
		/** The signed-in user's email. With `onsignout`, adds the account menu in the top right. */
		name?: string;
		email?: string;
		onsignout?: () => void | Promise<void>;
	}

	const { backHref = '/orgs', name, email, onsignout }: Props = $props();
</script>

<div class="relative min-h-dvh flex items-center justify-center p-6">
	<!-- One row, so the back button and the account menu share a centre line. -->
	<div class="absolute inset-x-4 top-4 flex items-center justify-between">
		<Button variant="ghost" href={backHref}>
			<ArrowLeftIcon />
			Back
		</Button>
		{#if email && onsignout}
			<UserMenu {name} {email} {onsignout} />
		{/if}
	</div>

	<p class="text-center text-lg text-on-surface-subtle select-none">
		Ask your organizer for an invite link.
	</p>
</div>
