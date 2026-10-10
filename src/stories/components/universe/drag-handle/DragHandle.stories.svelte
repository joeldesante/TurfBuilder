<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import DragHandle from './DragHandle.svelte';

	const { Story } = defineMeta({
		title: 'Components/Universe/DragHandle',
		component: DragHandle,
		args: { ondragstart: () => {} }
	});
</script>

<Story name="Default" />
