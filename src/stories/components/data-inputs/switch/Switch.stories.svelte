<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import Switch from './Switch.svelte'
	import FormField from '../form-field/FormField.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/Switch',
		component: Switch,
		tags: ['autodocs'],
		argTypes: {
			checked: {
				control: 'boolean',
				description: 'Whether the switch is on. This is a bindable prop.'
			},
			disabled: {
				control: 'boolean',
				description:
					'Whether the switch is disabled. Can also be inherited from a parent FormField.'
			},
			children: {
				control: false,
				description:
					'Optional label text rendered as an inline `<label>`. When omitted, the switch renders without a label.'
			},
			id: {
				control: false,
				table: { category: 'Derived Props' },
				description:
					'The id attribute. Auto-inherited from FormField context if not provided.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					'A toggle switch built on bits-ui. Renders its own inline label when children are provided. Wrap in FormField for validation and helper text.'
			}
		}
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
