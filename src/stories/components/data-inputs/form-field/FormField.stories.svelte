<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import FormField from './FormField.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/FormField',
		component: FormField,
		tags: ['autodocs'],
		argTypes: {
			requirement: {
				control: { type: 'select' },
				options: ['none', 'required', 'optional']
			},
			labelVisibility: {
				control: { type: 'radio' },
				options: ['visible', 'sr-only']
			}
		}
	})
</script>

<Story name="Default" args={{ label: 'Email address' }} asChild>
	<FormField label="Email address">
		<input
			type="email"
			placeholder="you@example.com"
			class="h-12 md:h-10 rounded-md border border-outline bg-surface px-3 text-base text-on-surface"
		/>
	</FormField>
</Story>

<Story name="With Helper Text" asChild>
	<FormField label="Email address" helperText="We'll only use this to contact you.">
		<input
			type="email"
			placeholder="you@example.com"
			class="h-12 md:h-10 rounded-md border border-outline bg-surface px-3 text-base text-on-surface"
		/>
	</FormField>
</Story>

<Story name="Required" asChild>
	<FormField label="Email address" requirement="required">
		<input
			type="email"
			placeholder="you@example.com"
			class="h-12 md:h-10 rounded-md border border-outline bg-surface px-3 text-base text-on-surface"
		/>
	</FormField>
</Story>

<Story name="Optional" asChild>
	<FormField label="Nickname" requirement="optional">
		<input
			type="text"
			placeholder="Optional nickname"
			class="h-12 md:h-10 rounded-md border border-outline bg-surface px-3 text-base text-on-surface"
		/>
	</FormField>
</Story>

<Story name="With Errors" asChild>
	<FormField
		label="Email address"
		errors={['Please enter a valid email address.']}
		dirty={true}
	>
		<input
			type="email"
			value="not-an-email"
			class="h-12 md:h-10 rounded-md border border-error bg-surface px-3 text-base text-on-surface"
		/>
	</FormField>
</Story>

<Story name="Disabled" asChild>
	<FormField label="Email address" disabled={true}>
		<input
			type="email"
			disabled
			placeholder="you@example.com"
			class="h-12 md:h-10 rounded-md border border-outline bg-surface px-3 text-base text-on-surface opacity-50 cursor-not-allowed"
		/>
	</FormField>
</Story>

<Story name="Hidden Label" asChild>
	<FormField label="Search" labelVisibility="sr-only">
		<input
			type="search"
			placeholder="Search..."
			class="h-12 md:h-10 rounded-md border border-outline bg-surface px-3 text-base text-on-surface"
		/>
	</FormField>
</Story>
