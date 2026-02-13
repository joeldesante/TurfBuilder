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
				options: ['text', 'email', 'password', 'url', 'tel', 'search', 'number']
			}
		}
	})
</script>

<Story name="Default" args={{ placeholder: 'Enter text...' }} />

<Story name="With FormField" asChild>
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
