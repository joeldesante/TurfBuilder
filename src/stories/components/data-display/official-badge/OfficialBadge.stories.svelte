<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import OfficialBadge from './OfficialBadge.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Display/OfficialBadge',
		component: OfficialBadge,
		tags: ['autodocs']
	});
</script>

<Story name="Default" />
