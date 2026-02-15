<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import TextInput from './TextInput.svelte'
	import FormField from '../form-field/FormField.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/TextInput',
		component: TextInput,
		tags: ['autodocs'],
		argTypes: {
			type: {
				control: { type: 'select' },
				options: ['text', 'email', 'password', 'url', 'tel', 'search', 'number'],
				description: 'The type of input, which determines the expected format and may trigger specific virtual keyboards on mobile devices.'
			},
			placeholder: {
				control: 'text',
				description: 'A short hint that demonstrates the expected format of the input when empty. This should only be used when needed.'
			},
			value: {
				control: 'text',
				description: 'The current value of the input. This is a bindable prop.'
			},
			id: {
				table: { category: 'Derived Props' },
				control: false,
				description: 'The id attribute for the input element. Auto-inherited from `FormField` context if not provided.'
			},
			grouped: {
				description: 'Whether the input is visually grouped with other inputs, which affects focus and border styles. This is typically used when the input is wrapped in an `InputGroup` component.',
				control: false,
				table: { category: 'Derived Props' }
			},
			disabled: {
				description: 'Whether the input is disabled. This can also be inherited from a parent `FormField` component.',
				control: 'boolean'
			},
			readonly: {
				description: 'Whether the input is read-only. This prevents user input but does not disable the element.',
				control: 'boolean'
			}
		},
		parameters: {
			docs: {
				subtitle: 'A styled native HTML Input element. To use with a label, helper text, validation, etc., nest within the FormField component.'
			}
		}
	})
</script>

<Story name="Default" args={{ placeholder: 'Enter text...' }} />

<Story name="Within FormField Wrapper" asChild>
	<FormField label="Email address" helperText="We'll only use this to contact you.">
		<TextInput type="email" placeholder="you@example.com" />
	</FormField>
</Story>

<Story name="Required with FormField" asChild>
	<FormField label="Email address" requirement="required">
		<TextInput type="email" placeholder="you@example.com" required />
	</FormField>
</Story>

<Story name="With Errors" asChild>
	<FormField
		label="Email address"
		errors={['Please enter a valid email address.']}
		dirty={true}
	>
		<TextInput type="email" value="not-an-email" />
	</FormField>
</Story>

<Story name="Disabled" args={{ placeholder: 'Disabled input', disabled: true }} />

<Story name="Disabled with FormField" asChild>
	<FormField label="Email address" disabled={true}>
		<TextInput type="email" placeholder="you@example.com" />
	</FormField>
</Story>

<Story name="Readonly" args={{ value: 'Read-only value', readonly: true }} />

<Story name="Standalone" asChild>
	<TextInput placeholder="Search surveys..." type="search" />
</Story>
