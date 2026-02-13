<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import Textarea from './Textarea.svelte'
	import FormField from '../form-field/FormField.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/Textarea',
		component: Textarea,
		tags: ['autodocs']
	})
</script>

<Story name="Default" args={{ placeholder: 'Enter your message...' }} />

<Story name="With Rows" args={{ placeholder: 'Write a longer message...', rows: 6 }} />

<Story name="With FormField" asChild>
	<FormField label="Description" helperText="Briefly describe the issue you encountered.">
		<Textarea placeholder="What happened?" rows={4} />
	</FormField>
</Story>

<Story name="Required with FormField" asChild>
	<FormField label="Notes" requirement="required">
		<Textarea placeholder="Add your notes..." rows={4} />
	</FormField>
</Story>

<Story name="With Errors" asChild>
	<FormField
		label="Description"
		errors={['Description must be at least 20 characters.']}
		dirty={true}
	>
		<Textarea value="Too short" rows={4} />
	</FormField>
</Story>

<Story name="Disabled" args={{ placeholder: 'Disabled textarea', disabled: true }} />

<Story name="Disabled with FormField" asChild>
	<FormField label="Description" disabled={true}>
		<Textarea placeholder="Cannot edit..." rows={4} />
	</FormField>
</Story>

<Story name="Readonly" args={{ value: 'This content is read-only.', readonly: true, rows: 3 }} />
