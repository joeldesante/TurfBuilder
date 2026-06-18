<script module lang="ts">
	export const meta = {
		title: 'Pages/Legal/Privacy',
		component: Privacy
	};
</script>

<script lang="ts">
	import { Story } from '@storybook/addon-svelte-csf';
	import Privacy from './Privacy.svelte';
</script>

<Story name="Default">
	<Privacy />
</Story>
