<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import ToggleGroup from './ToggleGroup.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/ToggleGroup',
		component: ToggleGroup,
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
					'Array of toggle items, each with `value`, `label`, and optional `disabled`.'
			},
			type: {
				control: { type: 'radio' },
				options: ['single', 'multiple'],
				description:
					"Selection mode. 'single' allows one selection (value is a string), 'multiple' allows many (value is a string array)."
			},
			value: {
				control: false,
				description:
					"The selected value(s). String when type='single', string array when type='multiple'. This is a bindable prop."
			},
			orientation: {
				control: { type: 'radio' },
				options: ['vertical', 'horizontal'],
				description: 'Layout direction of the toggle items.'
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
				description: 'Disables all toggle items in the group.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					"A self-contained group of selectable toggle buttons built on bits-ui. type='single' behaves like radios, type='multiple' behaves like checkboxes."
			}
		}
	})

	const viewItems = [
		{ value: 'list', label: 'List' },
		{ value: 'grid', label: 'Grid' },
		{ value: 'map', label: 'Map' }
	]

	const dayItems = [
		{ value: 'mon', label: 'Mon' },
		{ value: 'tue', label: 'Tue' },
		{ value: 'wed', label: 'Wed' },
		{ value: 'thu', label: 'Thu' },
		{ value: 'fri', label: 'Fri' },
		{ value: 'sat', label: 'Sat', disabled: true },
		{ value: 'sun', label: 'Sun', disabled: true }
	]
</script>

<Story
	name="Default"
	args={{ label: 'View', items: viewItems, type: 'single' }}
/>

<Story
	name="With Preselected"
	args={{ label: 'View', items: viewItems, type: 'single', value: 'grid' }}
/>

<Story
	name="Multiple"
	args={{ label: 'Available days', items: dayItems, type: 'multiple', value: ['mon', 'wed'] }}
/>

<Story
	name="Vertical"
	args={{ label: 'View', items: viewItems, type: 'single', orientation: 'vertical' }}
/>

<Story
	name="Required"
	args={{ label: 'View', items: viewItems, type: 'single', requirement: 'required' }}
/>

<Story
	name="With Helper Text"
	args={{
		label: 'View',
		items: viewItems,
		type: 'single',
		helperText: 'Choose how to display results.'
	}}
/>

<Story
	name="With Errors"
	args={{
		label: 'View',
		items: viewItems,
		type: 'single',
		errors: ['Please select a view mode.'],
		dirty: true
	}}
/>

<Story
	name="Disabled"
	args={{ label: 'View', items: viewItems, type: 'single', disabled: true }}
/>

<Story
	name="With Disabled Items"
	args={{ label: 'Available days', items: dayItems, type: 'multiple' }}
/>
