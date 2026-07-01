<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Card from './Card.svelte';

	const { Story } = defineMeta({
		title: 'Components/Layout/Card',
		component: Card,
		tags: ['autodocs']
	});
</script>

<Story name="Default" />
