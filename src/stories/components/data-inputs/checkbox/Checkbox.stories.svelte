<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import Checkbox from './Checkbox.svelte'
	import FormField from '../form-field/FormField.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/Checkbox',
		component: Checkbox,
		tags: ['autodocs'],
		argTypes: {
			checked: {
				control: 'boolean',
				description: 'Whether the checkbox is checked. This is a bindable prop.'
			},
			indeterminate: {
				control: 'boolean',
				description:
					"Whether the checkbox is in an indeterminate state, typically used for 'select all' patterns."
			},
			disabled: {
				control: 'boolean',
				description:
					'Whether the checkbox is disabled. Can also be inherited from a parent CheckboxGroup or FormField.'
			},
			children: {
				control: false,
				description:
					'Optional label text rendered as an inline `<label>`. When omitted, the checkbox renders without a label.'
			},
			id: {
				control: false,
				table: { category: 'Derived Props' },
				description:
					'The id attribute for the checkbox. Auto-inherited from CheckboxGroup or FormField context if not provided.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					'A styled checkbox that renders its own inline label when children are provided. Use in CheckboxGroup to add a Legend and validation, or in FormField if there should only be a single checkbox with a label.'
			}
		}
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

<Story name="With Validation" asChild>
	<FormField
		label="Terms of Service"
		labelVisibility="sr-only"
		errors={['You must accept the terms to continue.']}
		dirty={true}
	>
		<Checkbox>I agree to the Terms of Service and Privacy Policy</Checkbox>
	</FormField>
</Story>
