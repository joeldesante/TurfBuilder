<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import CheckboxGroup from './CheckboxGroup.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/CheckboxGroup',
		component: CheckboxGroup,
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

	const notificationItems = [
		{ value: 'email', label: 'Email notifications' },
		{ value: 'sms', label: 'SMS notifications' },
		{ value: 'push', label: 'Push notifications' }
	]

	const permissionItems = [
		{ value: 'read', label: 'Read access' },
		{ value: 'write', label: 'Write access' },
		{ value: 'admin', label: 'Admin access', disabled: true }
	]
</script>

<Story
	name="Default"
	args={{ label: 'Notifications', items: notificationItems }}
/>

<Story
	name="With Preselected"
	args={{ label: 'Notifications', items: notificationItems, value: ['email', 'push'] }}
/>

<Story
	name="Horizontal"
	args={{ label: 'Notifications', items: notificationItems, orientation: 'horizontal' }}
/>

<Story
	name="Required"
	args={{ label: 'Notifications', items: notificationItems, requirement: 'required' }}
/>

<Story
	name="With Helper Text"
	args={{
		label: 'Notifications',
		items: notificationItems,
		helperText: 'Choose how you want to be notified.'
	}}
/>

<Story
	name="With Errors"
	args={{
		label: 'Notifications',
		items: notificationItems,
		errors: ['Please select at least one notification method.'],
		dirty: true
	}}
/>

<Story
	name="Disabled"
	args={{ label: 'Notifications', items: notificationItems, disabled: true }}
/>

<Story
	name="With Disabled Items"
	args={{ label: 'Permissions', items: permissionItems }}
/>
