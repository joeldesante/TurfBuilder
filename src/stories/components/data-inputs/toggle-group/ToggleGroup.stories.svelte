<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import ToggleGroup from './ToggleGroup.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/ToggleGroup',
		component: ToggleGroup,
		tags: ['autodocs'],
		argTypes: {
			type: {
				control: { type: 'radio' },
				options: ['single', 'multiple']
			},
			orientation: {
				control: { type: 'radio' },
				options: ['vertical', 'horizontal']
			},
			requirement: {
				control: { type: 'select' },
				options: ['none', 'required', 'optional']
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
