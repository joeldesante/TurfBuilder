<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import Checkbox from './Checkbox.svelte'
	import FormField from '../form-field/FormField.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/Checkbox',
		component: Checkbox,
		tags: ['autodocs']
	})
</script>

<Story name="Default">
	Accept terms and conditions
</Story>

<Story name="Checked" args={{ checked: true }}>
	Accept terms and conditions
</Story>

<Story name="Indeterminate" args={{ indeterminate: true }}>
	Select all items
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
		label="Terms of Service"
		requirement="required"
		errors={['You must accept the terms to continue.']}
		dirty={true}
	>
		<Checkbox>I agree to the Terms of Service and Privacy Policy</Checkbox>
	</FormField>
</Story>

<Story name="With Helper Text" asChild>
	<FormField label="Notifications" helperText="You can change this later in settings.">
		<Checkbox>Send me email notifications</Checkbox>
	</FormField>
</Story>
