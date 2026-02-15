<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import InputGroup from './InputGroup.svelte'
	import TextInput from '../text-input/TextInput.svelte'
	import FormField from '../form-field/FormField.svelte'
	import { MagnifyingGlassIcon } from 'phosphor-svelte'
	import { CurrencyDollarIcon } from 'phosphor-svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/InputGroup',
		component: InputGroup,
		tags: ['autodocs'],
		argTypes: {
			leading: {
				control: false,
				description:
					"A Svelte snippet rendered before the input. Typically an icon or short text prefix like 'https://'."
			},
			trailing: {
				control: false,
				description:
					"A Svelte snippet rendered after the input. Typically an icon or unit label like 'USD'."
			},
			disabled: {
				control: 'boolean',
				description:
					'Whether the group appears disabled. Can also be inherited from FormField context.'
			},
			children: {
				control: false,
				description:
					'The input element (typically a TextInput with `grouped` prop) placed between leading and trailing addons.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					'A layout wrapper that visually groups a text input with leading and/or trailing addons (icons, text). Reads FormField context for invalid and disabled states.'
			}
		}
	})
</script>

<Story name="With Leading Text" asChild>
	<InputGroup>
		{#snippet leading()}
			https://
		{/snippet}
		<TextInput placeholder="example.com" type="url" grouped />
	</InputGroup>
</Story>

<Story name="With Leading Icon" asChild>
	<InputGroup>
		{#snippet leading()}
			<MagnifyingGlassIcon />
		{/snippet}
		<TextInput placeholder="Search..." grouped />
	</InputGroup>
</Story>

<Story name="With Trailing Text" asChild>
	<InputGroup>
		<TextInput type="number" placeholder="0.00" grouped />
		{#snippet trailing()}
			USD
		{/snippet}
	</InputGroup>
</Story>

<Story name="With Leading, Trailing, and Within FormField" asChild>
	<FormField label="Amount" helperText="Enter the donation amount.">
		<InputGroup>
			{#snippet leading()}
				<CurrencyDollarIcon />
			{/snippet}
			<TextInput type="number" placeholder="0.00" grouped />
			{#snippet trailing()}
				USD
			{/snippet}
		</InputGroup>
	</FormField>
</Story>

<Story name="Disabled" asChild>
	<InputGroup>
		{#snippet leading()}
			https://
		{/snippet}
		<TextInput placeholder="example.com" disabled grouped />
	</InputGroup>
</Story>
