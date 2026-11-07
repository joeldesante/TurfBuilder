<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import UserMenu from './UserMenu.svelte';

	const { Story } = defineMeta({
		title: 'Components/Actions/User Menu',
		component: UserMenu,
		tags: ['autodocs'],
		parameters: {
			docs: {
				subtitle:
					"The user's initials in a circle, as in the staff sidebar, that open the signed-in email and a Sign Out action, for pages with no sidebar."
			}
		}
	});

	function noop() {}
</script>

<Story name="Default" args={{ name: 'Alex Rivera', email: 'alex@example.com', onsignout: noop }} />
