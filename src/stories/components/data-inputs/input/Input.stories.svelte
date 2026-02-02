<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import Input from './Input.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/Input',
		component: Input,
		args: {
			label: 'Username',
			placeholder: 'Enter your username'
		}
	})
</script>

<Story name="With Label" />

<Story name="Without Label" args={{ label: '' }} />
