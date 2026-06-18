<script module lang="ts">
	export const meta = {
		title: 'Pages/Legal/Terms',
		component: Terms
	};
</script>

<script lang="ts">
	import { Story } from '@storybook/addon-svelte-csf';
	import Terms from './Terms.svelte';
</script>

<Story name="Default">
	<Terms />
</Story>
