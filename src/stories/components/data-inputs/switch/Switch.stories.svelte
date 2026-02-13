<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import Switch from './Switch.svelte'
	import FormField from '../form-field/FormField.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/Switch',
		component: Switch,
		tags: ['autodocs']
	})
</script>

<Story name="Default">
	Enable notifications
</Story>

<Story name="Checked" args={{ checked: true }}>
	Enable notifications
</Story>

<Story name="Disabled" args={{ disabled: true }}>
	Disabled option
</Story>

<Story name="Disabled Checked" args={{ disabled: true, checked: true }}>
	Disabled checked option
</Story>

<Story name="Without Label" args={{ checked: false }} />

<Story name="With FormField" asChild>
	<FormField
		label="Dark Mode"
		helperText="Toggle between light and dark theme."
	>
		<Switch>Use dark mode</Switch>
	</FormField>
</Story>

<Story name="With Error" asChild>
	<FormField
		label="Terms Agreement"
		requirement="required"
		errors={['You must enable this setting to continue.']}
		dirty={true}
	>
		<Switch>I agree to the terms</Switch>
	</FormField>
</Story>
