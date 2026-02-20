<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CheckboxGroup from './CheckboxGroup.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/CheckboxGroup',
		component: CheckboxGroup,
		tags: ['autodocs'],
		argTypes: {
			label: {
				control: 'text',
				description: 'The group label rendered as a `<legend>` inside the `<fieldset>`.'
			},
			items: {
				control: 'object',
				description: 'Array of checkbox items, each with `value`, `label`, and optional `disabled`.'
			},
			value: {
				control: 'object',
				description: 'Array of selected values. This is a bindable prop.'
			},
			orientation: {
				control: { type: 'radio' },
				options: ['vertical', 'horizontal'],
				description: 'Layout direction of the checkbox items.'
			},
			requirementIndicator: {
				control: { type: 'radio' },
				options: ['none', 'required', 'optional'],
				description:
					"Displays a visual indicator (asterisk or 'Optional' text) next to the label. UX only — does not enforce validation."
			},
			helperText: {
				control: 'text',
				description: 'Guidance text providing more context about the checkbox group.'
			},
			errors: {
				control: 'object',
				description: 'Array of error messages shown when the field is dirty and invalid.'
			},
			dirty: {
				control: 'boolean',
				description: 'Whether the group has been interacted with. Errors only display when dirty.'
			},
			disabled: {
				control: 'boolean',
				description: 'Disables all checkboxes in the group.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					'A self-contained group of Checkbox components inside a fieldset with legend, optional helper text, and error rendering'
			}
		}
	});

	const notificationItems = [
		{ value: 'email', label: 'Email notifications' },
		{ value: 'sms', label: 'SMS notifications' },
		{ value: 'push', label: 'Push notifications' }
	];

	const permissionItems = [
		{ value: 'read', label: 'Read access' },
		{ value: 'write', label: 'Write access' },
		{ value: 'admin', label: 'Admin access', disabled: true }
	];
</script>

<Story name="Default" args={{ label: 'Notifications', items: notificationItems }} />

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
	args={{ label: 'Notifications', items: notificationItems, requirementIndicator: 'required' }}
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

<Story name="With Disabled Items" args={{ label: 'Permissions', items: permissionItems }} />
