<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import InputGroup from './InputGroup.svelte'
	import TextInput from '../text-input/TextInput.svelte'
	import FormField from '../form-field/FormField.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/InputGroup',
		component: InputGroup,
		tags: ['autodocs']
	})
</script>

<Story name="With Leading Text" asChild>
	<FormField label="Website">
		<InputGroup>
			{#snippet leading()}
				<span class="text-sm">https://</span>
			{/snippet}
			<TextInput placeholder="example.com" grouped />
		</InputGroup>
	</FormField>
</Story>

<Story name="With Trailing Text" asChild>
	<FormField label="Price">
		<InputGroup>
			<TextInput type="number" placeholder="0.00" grouped />
			{#snippet trailing()}
				<span class="text-sm">USD</span>
			{/snippet}
		</InputGroup>
	</FormField>
</Story>

<Story name="With Leading and Trailing" asChild>
	<FormField label="Amount" helperText="Enter the donation amount.">
		<InputGroup>
			{#snippet leading()}
				<span class="text-sm font-medium">$</span>
			{/snippet}
			<TextInput type="number" placeholder="0.00" grouped />
			{#snippet trailing()}
				<span class="text-sm">USD</span>
			{/snippet}
		</InputGroup>
	</FormField>
</Story>

<Story name="With Errors" asChild>
	<FormField label="Website" errors={['Please enter a valid URL.']} dirty={true}>
		<InputGroup>
			{#snippet leading()}
				<span class="text-sm">https://</span>
			{/snippet}
			<TextInput placeholder="example.com" grouped />
		</InputGroup>
	</FormField>
</Story>

<Story name="Disabled" asChild>
	<FormField label="Website" disabled={true}>
		<InputGroup>
			{#snippet leading()}
				<span class="text-sm">https://</span>
			{/snippet}
			<TextInput placeholder="example.com" grouped />
		</InputGroup>
	</FormField>
</Story>

<Story name="Standalone" asChild>
	<InputGroup>
		{#snippet leading()}
			<span class="text-sm">Search:</span>
		{/snippet}
		<TextInput placeholder="Type to search..." grouped />
	</InputGroup>
</Story>
