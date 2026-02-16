<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Select from './Select.svelte';
	import FormField from '../form-field/FormField.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/Select',
		component: Select,
		tags: ['autodocs'],
		argTypes: {
			items: {
				control: 'object',
				description:
					'Flat array of options, each with `value`, `label`, and optional `disabled`. Use `items` or `groups`, not both.'
			},
			groups: {
				control: 'object',
				description:
					'Array of option groups, each with a `heading` and nested `items` array. Renders as `<optgroup>` elements.'
			},
			value: {
				control: 'text',
				description: 'The currently selected value. This is a bindable prop.'
			},
			placeholder: {
				control: 'text',
				description: 'Placeholder text shown as a disabled first option when no value is selected.'
			},
			disabled: {
				control: 'boolean',
				description:
					'Whether the select is disabled. Can also be inherited from a parent FormField.'
			},
			id: {
				control: false,
				table: { category: 'Derived Props' },
				description: 'The id attribute. Auto-inherited from FormField context if not provided.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					'A styled native HTML Select element. Nest within FormField for labels, helper text, and validation.'
			}
		}
	});

	const stateItems = [
		{ value: 'ca', label: 'California' },
		{ value: 'ny', label: 'New York' },
		{ value: 'tx', label: 'Texas' },
		{ value: 'fl', label: 'Florida' }
	];

	const roleItems = [
		{ value: 'user', label: 'User' },
		{ value: 'fieldOrganizer', label: 'Field Organizer' },
		{ value: 'campaignManager', label: 'Campaign Manager' }
	];

	const regionGroups = [
		{
			heading: 'West Coast',
			items: [
				{ value: 'ca', label: 'California' },
				{ value: 'or', label: 'Oregon' },
				{ value: 'wa', label: 'Washington' }
			]
		},
		{
			heading: 'East Coast',
			items: [
				{ value: 'ny', label: 'New York' },
				{ value: 'ma', label: 'Massachusetts' },
				{ value: 'fl', label: 'Florida' }
			]
		}
	];
</script>

<Story name="Default" args={{ items: stateItems, placeholder: 'Select a state...' }} />

<Story name="With FormField" asChild>
	<FormField label="State" helperText="Select the state for this turf.">
		<Select items={stateItems} placeholder="Select a state..." />
	</FormField>
</Story>

<Story name="Required with FormField" asChild>
	<FormField label="Role" requirement="required">
		<Select items={roleItems} placeholder="Choose a role..." />
	</FormField>
</Story>

<Story name="With Groups" asChild>
	<FormField label="Region" helperText="Grouped by coast.">
		<Select groups={regionGroups} placeholder="Select a region..." />
	</FormField>
</Story>

<Story name="With Errors" asChild>
	<FormField label="State" errors={['Please select a state.']} dirty={true}>
		<Select items={stateItems} placeholder="Select a state..." />
	</FormField>
</Story>

<Story name="Disabled" args={{ items: stateItems, placeholder: 'Disabled', disabled: true }} />

<Story name="Disabled with FormField" asChild>
	<FormField label="State" disabled={true}>
		<Select items={stateItems} placeholder="Select a state..." />
	</FormField>
</Story>

<Story name="With Disabled Option" asChild>
	<FormField label="Role">
		<Select
			items={[
				{ value: 'user', label: 'User' },
				{ value: 'fieldOrganizer', label: 'Field Organizer' },
				{ value: 'campaignManager', label: 'Campaign Manager', disabled: true }
			]}
			placeholder="Choose a role..."
		/>
	</FormField>
</Story>
