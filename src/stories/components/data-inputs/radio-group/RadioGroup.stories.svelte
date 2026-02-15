<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import RadioGroup from './RadioGroup.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/RadioGroup',
		component: RadioGroup,
		tags: ['autodocs'],
		argTypes: {
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
