<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Button from './Button.svelte'

	const { Story } = defineMeta({
		title: 'Components/Actions/Button',
		component: Button,
		args: {
			label: 'Click me'
		}
	})
</script>

<Story name="Default" />

<Story name="Disabled" args={{ label: 'Disabled', disabled: true }} />
