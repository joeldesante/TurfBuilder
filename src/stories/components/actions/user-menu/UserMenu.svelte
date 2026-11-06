<script lang="ts">
	import Avatar from '$components/data-display/avatar/Avatar.svelte';
	import DropdownMenu from '$components/actions/dropdown-menu/DropdownMenu.svelte';
	import { SignOutIcon } from 'phosphor-svelte';

	interface Props {
		/** The user's name; its first letters fill the avatar, as in the staff sidebar. */
		name?: string;
		/** Shown at the top of the menu so a wrong account is easy to spot. */
		email: string;
		onsignout: () => void | Promise<void>;
	}

	const { name, email, onsignout }: Props = $props();

	const label = $derived(name?.trim() || email);

	const items = $derived([
		// A disabled entry is the menu's way of showing a line that is not an action.
		{ label: email, disabled: true },
		{ separator: true as const },
		{ label: 'Sign Out', icon: SignOutIcon, onclick: onsignout }
	]);
</script>

<DropdownMenu {items} align="end">
	{#snippet trigger(props)}
		<button
			{...props}
			type="button"
			aria-label="Account menu"
			class="flex rounded-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
		>
			<Avatar username={label} size="sm" />
		</button>
	{/snippet}
</DropdownMenu>
