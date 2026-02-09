<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import Badge from './Badge.svelte'
	import { CheckCircleIcon, WarningIcon, XCircleIcon, InfoIcon, StarIcon } from 'phosphor-svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Display/Badge',
		component: Badge,
		tags: ['autodocs'],
		argTypes: {
			variant: {
				control: { type: 'select' },
				options: ['default', 'primary', 'secondary', 'success', 'warning', 'error', 'info']
			},
			size: {
				control: { type: 'radio' },
				options: ['sm', 'md']
			}
		}
	})
</script>

<Story name="Default">
	Default badge
</Story>

<Story name="Primary" args={{ variant: 'primary' }}>
	Primary badge
</Story>

<Story name="Secondary" args={{ variant: 'secondary' }}>
	Secondary badge
</Story>

<Story name="Success" args={{ variant: 'success' }}>
	<CheckCircleIcon />
	Success with icon
</Story>

<Story name="Warning" args={{ variant: 'warning' }}>
	<WarningIcon />
	Warning with icon
</Story>

<Story name="Error" args={{ variant: 'error' }}>
	<XCircleIcon />
	Error with icon
</Story>

<Story name="Info" args={{ variant: 'info' }}>
	<InfoIcon />
	Info with icon
</Story>

<Story name="Small Size" args={{ size: 'sm' }}>
	<StarIcon />
	Small badge
</Story>
