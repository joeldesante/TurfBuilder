<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import JoinOrg from './JoinOrg.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Orgs/JoinOrg',
		component: JoinOrg,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle:
					'Where canvassers land when they are here for an existing organization. For now it only tells them to ask for an invite link.'
			}
		}
	});
</script>

<Story name="Default" />
