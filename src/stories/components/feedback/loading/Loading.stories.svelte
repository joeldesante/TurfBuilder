<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Loading from './Loading.svelte';

	const { Story } = defineMeta({
		title: 'Components/Feedback/Loading',
		component: Loading,
		tags: ['autodocs'],
		parameters: {
			docs: {
				subtitle:
					'The TurfBuilder text logo with a lighter green wave and a subtle bulge sweeping diagonally from the top left corner to the bottom right while content loads.'
			}
		}
	});
</script>

<Story name="Default" />

<Story name="Large" args={{ width: 320 }} />

<Story name="Reduced Motion" args={{ reducedMotion: true }} />
