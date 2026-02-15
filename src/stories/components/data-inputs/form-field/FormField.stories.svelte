<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import FormField from './FormField.svelte'
	import TextInput from '../text-input/TextInput.svelte'
	import Textarea from '../textarea/Textarea.svelte'
	import Select from '../select/Select.svelte'
	import InputGroup from '../input-group/InputGroup.svelte'
	import Checkbox from '../checkbox/Checkbox.svelte'
	import Switch from '../switch/Switch.svelte'
	import { AtIcon } from 'phosphor-svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/FormField',
		component: FormField,
		tags: ['autodocs'],
		argTypes: {
			label: {
				control: 'text',
				description:
					'The text label for the form field, which describes the purpose of the input.'
			},
			children: {
				control: false,
				description:
					'The input element(s) that are associated with this form field. This should be a Svelte snippet containing one or more input components.'
			},
			helperText: {
				control: 'text',
				description:
					'Additional text that provides guidance or context for the input. Linked via `aria-describedby` for accessibility.'
			},
			labelVisibility: {
				control: { type: 'radio' },
				description:
					'Controls the visibility of the label. "visible" shows the label normally, while "sr-only" hides it visually but keeps it accessible to screen readers.'
			},
			requirementIndicator: {
				control: { type: 'radio' },
				options: ['none', 'required', 'optional'],
				description:
					'Displays a visual indication of whether the input is required or optional. This is for UX purposes only and does not enforce validation.'
			},
			id: {
				table: { category: 'Derived Props' },
				control: false,
				description:
					'The id attribute for the form field, which is used to associate the label with the input. This is automatically generated if not provided.'
			},
			errors: {
				control: 'object',
				description:
					'An array of error messages to display when the input is in an invalid state.'
			},
			dirty: {
				control: 'boolean',
				description:
					'Indicates whether the input has been interacted with, which can be used to determine when to show validation errors.'
			},
			disabled: {
				control: 'boolean',
				description:
					'Whether the form field is disabled, which also disables any nested input components.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					'A wrapper component for form fields that provides a label, helper text, and error messages. It also manages disabled state and visual grouping for nested input components.'
			}
		}
	})
</script>

<Story name="TextInput" asChild>
	<FormField label="Full name">
		<TextInput />
	</FormField>
</Story>

<Story name="TextInput with Helper Text" asChild>
	<FormField label="Nickname" helperText="What should we call you?">
		<TextInput />
	</FormField>
</Story>

<Story name="TextInput with Required Indicator" asChild>
	<FormField label="Email address" requirementIndicator="required">
		<TextInput type="email" required />
	</FormField>
</Story>

<Story name="TextInput with Optional Indicator" asChild>
	<FormField label="Nickname" requirementIndicator="optional">
		<TextInput />
	</FormField>
</Story>

<Story name="TextInput with Errors" asChild>
	<FormField label="Email address" errors={['Please enter a valid email address.']} dirty={true}>
		<TextInput type="email" value="not-an-email" />
	</FormField>
</Story>

<Story name="TextInput Disabled" asChild>
	<FormField label="Email address" helperText="We'll only use this to contact you." disabled={true}>
		<TextInput type="email" placeholder="you@example.com" />
	</FormField>
</Story>

<Story name="TextInput Hidden Label" asChild>
	<FormField label="Search" labelVisibility="sr-only">
		<TextInput type="search" placeholder="Search..." />
	</FormField>
</Story>

<Story name="Textarea" asChild>
	<FormField label="Bio" helperText="Tell us a little about yourself.">
		<Textarea />
	</FormField>
</Story>

<Story name="Textarea with Error" asChild>
	<FormField label="Bio" helperText="Tell us a little about yourself." errors={['Bio must be at least 10 characters.']} dirty={true}>
		<Textarea value="Too short" />
	</FormField>
</Story>

<Story name="Textarea with Multiple Errors" asChild>
	<FormField label="Bio" helperText="Tell us a little about yourself." errors={['Bio must be at least 10 characters.', 'Bio cannot contain special characters.']} dirty={true}>
		<Textarea value="Too short" />
	</FormField>
</Story>

<Story name="Textarea Disabled" asChild>
	<FormField label="Notes" disabled={true}>
		<Textarea placeholder="Add notes..." />
	</FormField>
</Story>

<Story name="Select" asChild>
	<FormField label="Country">
		<Select
			placeholder="Choose a country"
			items={[
				{ value: 'us', label: 'United States' },
				{ value: 'ca', label: 'Canada' },
				{ value: 'mx', label: 'Mexico' }
			]}
		/>
	</FormField>
</Story>

<Story name="Select with Helper Text" asChild>
	<FormField label="Region" helperText="Select your operating region.">
		<Select
			placeholder="Choose a region"
			items={[
				{ value: 'northeast', label: 'Northeast' },
				{ value: 'southeast', label: 'Southeast' },
				{ value: 'midwest', label: 'Midwest' },
				{ value: 'west', label: 'West' }
			]}
		/>
	</FormField>
</Story>

<Story name="Select Disabled" asChild>
	<FormField label="Country" helperText="You cannot change the country." disabled={true}>
		<Select
			placeholder="Choose a country"
			items={[
				{ value: 'us', label: 'United States' },
				{ value: 'ca', label: 'Canada' }
			]}
		/>
	</FormField>
</Story>

<Story name="InputGroup with Leading Icon" asChild>
	<FormField label="Email address">
		<InputGroup>
			{#snippet leading()}
				<AtIcon />
			{/snippet}
			<TextInput placeholder="you@example.com" type="email" grouped />
		</InputGroup>
	</FormField>
</Story>

<Story name="InputGroup with Trailing Text" asChild>
	<FormField label="Price">
		<InputGroup>
			<TextInput type="number" placeholder="0.00" grouped />
			{#snippet trailing()}
				USD
			{/snippet}
		</InputGroup>
	</FormField>
</Story>

<Story name="Checkbox" asChild>
	<FormField label="Terms" labelVisibility="sr-only">
		<Checkbox>I agree to the terms and conditions</Checkbox>
	</FormField>
</Story>

<Story name="Checkbox with Helper Text" asChild>
	<FormField label="Marketing" labelVisibility="sr-only" helperText="You can unsubscribe at any time.">
		<Checkbox>Send me marketing emails</Checkbox>
	</FormField>
</Story>

<Story name="Checkbox with Errors" asChild>
	<FormField
		label="Terms"
		labelVisibility="sr-only"
		errors={['You must agree to the terms.']}
		dirty={true}
	>
		<Checkbox>I agree to the terms and conditions</Checkbox>
	</FormField>
</Story>

<Story name="Checkbox Disabled" asChild>
	<FormField label="Terms" labelVisibility="sr-only" disabled={true}>
		<Checkbox>I agree to the terms and conditions</Checkbox>
	</FormField>
</Story>

<Story name="Switch" asChild>
	<FormField label="Notifications" labelVisibility="sr-only">
		<Switch>Enable notifications</Switch>
	</FormField>
</Story>

<Story name="Switch with Helper Text" asChild>
	<FormField
		label="Dark mode"
		labelVisibility="sr-only"
		helperText="Switches to a darker color scheme."
	>
		<Switch>Dark mode</Switch>
	</FormField>
</Story>

<Story name="Switch Disabled" asChild>
	<FormField label="Notifications" labelVisibility="sr-only" disabled={true}>
		<Switch>Enable notifications</Switch>
	</FormField>
</Story>
