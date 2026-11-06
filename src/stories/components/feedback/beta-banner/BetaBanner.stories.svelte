<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BetaBanner from './BetaBanner.svelte';

	const { Story } = defineMeta({
		title: 'Components/Feedback/BetaBanner',
		component: BetaBanner,
		tags: ['autodocs'],
		parameters: {
			docs: {
				subtitle:
					'A slim notice at the top of the staff pages saying TurfBuilder is in early development. Closing it is remembered in the browser.'
			}
		}
	});
</script>

<Story name="Default" args={{ storageKey: 'beta-banner-story' }} />
