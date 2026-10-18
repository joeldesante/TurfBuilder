<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Dropdown from './Dropdown.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/Dropdown',
		component: Dropdown,
		args: {
			'aria-label': 'Example',
			items: [
				{ value: 'all', label: 'All of the following' },
				{ value: 'any', label: 'At least one of the following' }
			]
		}
	});
</script>

<Story name="Default" args={{ value: 'all' }} />
<Story name="Placeholder" args={{ value: '', placeholder: 'Choose one...' }} />
<Story name="Disabled" args={{ value: 'all', disabled: true }} />
