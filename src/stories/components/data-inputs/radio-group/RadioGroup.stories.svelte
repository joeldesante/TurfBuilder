<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import RadioGroup from './RadioGroup.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/RadioGroup',
		component: RadioGroup,
		tags: ['autodocs'],
		argTypes: {
			label: {
				control: 'text',
				description:
					'The group label rendered as a `<legend>` inside the `<fieldset>`.'
			},
			items: {
				control: 'object',
				description:
					'Array of radio items, each with `value`, `label`, and optional `disabled`.'
			},
			value: {
				control: 'text',
				description: 'The currently selected value. This is a bindable prop.'
			},
			orientation: {
				control: { type: 'radio' },
				options: ['vertical', 'horizontal'],
				description: 'Layout direction of the radio items.'
			},
			requirement: {
				control: { type: 'select' },
				options: ['none', 'required', 'optional'],
				description:
					"Displays a visual indicator (asterisk or 'Optional' text) next to the label. UX only — does not enforce validation."
			},
			helperText: {
				control: 'text',
				description:
					'Guidance text shown below the group. Hidden when errors are visible.'
			},
			errors: {
				control: 'object',
				description:
					'Array of error messages shown when the field is dirty and invalid.'
			},
			dirty: {
				control: 'boolean',
				description:
					'Whether the group has been interacted with. Errors only display when dirty.'
			},
			disabled: {
				control: 'boolean',
				description: 'Disables all radio items in the group.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					'A self-contained radio group built on bits-ui inside a fieldset with legend, helper text, and error rendering. No FormField wrapper needed.'
			}
		}
	})

	const priorityItems = [
		{ value: 'low', label: 'Low priority' },
		{ value: 'medium', label: 'Medium priority' },
		{ value: 'high', label: 'High priority' }
	]

	const roleItems = [
		{ value: 'user', label: 'User' },
		{ value: 'organizer', label: 'Field Organizer' },
		{ value: 'manager', label: 'Campaign Manager', disabled: true }
	]
</script>

<Story
	name="Default"
	args={{ label: 'Priority', items: priorityItems }}
/>

<Story
	name="With Preselected"
	args={{ label: 'Priority', items: priorityItems, value: 'medium' }}
/>

<Story
	name="Horizontal"
	args={{ label: 'Priority', items: priorityItems, orientation: 'horizontal' }}
/>

<Story
	name="Required"
	args={{ label: 'Priority', items: priorityItems, requirement: 'required' }}
/>

<Story
	name="With Helper Text"
	args={{
		label: 'Priority',
		items: priorityItems,
		helperText: 'Choose the priority level for this task.'
	}}
/>

<Story
	name="With Errors"
	args={{
		label: 'Priority',
		items: priorityItems,
		errors: ['Please select a priority level.'],
		dirty: true
	}}
/>

<Story
	name="Disabled"
	args={{ label: 'Priority', items: priorityItems, disabled: true }}
/>

<Story
	name="With Disabled Items"
	args={{ label: 'Role', items: roleItems }}
/>
