<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import Checkbox from './Checkbox.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/Checkbox',
		component: Checkbox,
		args: {
			label: 'Accept terms and conditions',
			showLabel: true,
			disabled: false,
			checked: false
		},
		argTypes: {
			checked: {
				control: 'boolean'
			},
			showLabel: {
				control: 'boolean'
			},
			disabled: {
				control: 'boolean'
			}
		}
	})
</script>

<Story name="Default" />

<Story name="With Supporting Text" args={{
	label: 'Subscribe to newsletter',
	supportingText: 'Receive weekly updates about new features and announcements'
}} />

<Story name="Checked" args={{ checked: true }} />

<Story name="Without Label" args={{ showLabel: false }} />

<Story name="Disabled" args={{ disabled: true }} />

<Story name="Disabled Checked" args={{ disabled: true, checked: true }} />

<Story name="All Variants">
	{#snippet children()}
		<div class="flex flex-col gap-4">
			<Checkbox label="Default checkbox" />
			<Checkbox label="With supporting text" supportingText="Additional context for this option" />
			<Checkbox label="Checked by default" checked={true} />
			<Checkbox showLabel={false} />
			<Checkbox label="Disabled" disabled={true} />
			<Checkbox label="Disabled with supporting text" supportingText="This option is not available" disabled={true} />
		</div>
	{/snippet}
</Story>
