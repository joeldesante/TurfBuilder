<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import Button from './Button.svelte'
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon'
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon'
	import ArrowUpRightIcon from 'phosphor-svelte/lib/ArrowUpRightIcon'

	const { Story } = defineMeta({
		title: 'Components/Actions/Button',
		component: Button,
		tags: ['autodocs'],
		argTypes: {
			variant: {
				control: { type: 'select' },
				options: ['primary', 'secondary', 'outline', 'ghost', 'destructive']
			},
			type: {
				control: { type: 'select' },
				options: ['button', 'submit', 'reset']
			}
		}
	})
</script>


<Story name="Primary">
	Primary Button
</Story>

<Story name="Secondary" args={{ variant: 'secondary' }}>
	<PlusIcon />
	Secondary with icon
</Story>

<Story name="Outline" args={{ variant: 'outline' }}>
	Outline Button
</Story>

<Story name="Ghost" args={{ variant: 'ghost' }}>
	Ghost Button
</Story>

<Story name="Destructive" args={{ variant: 'destructive' }}>
	<TrashIcon />
	Delete Forever
</Story>

<Story name="Disabled" asChild>
  <div class="flex flex-wrap gap-6">
    <Button disabled>Primary</Button>
	<Button variant="secondary" disabled>Secondary</Button>
	<Button variant="outline" disabled>Outline</Button>
    <Button variant="ghost" disabled>Ghost</Button>
    <Button variant="destructive" disabled>Destructive</Button>
  </div>
</Story>

<Story name="Loading" args={{ loading: true }}>
	Saving...
</Story>

<Story name="Icon Only" asChild>
	<div class="flex flex-wrap items-center gap-4">
		<Button iconOnly aria-label="Add">
			<PlusIcon />
		</Button>
		<Button iconOnly variant="outline" aria-label="Delete">
			<TrashIcon />
		</Button>
	</div>
</Story>

<Story name="As Link" asChild>
	<div class="flex flex-wrap items-center gap-4">
		<Button href="https://example.com">Visit site <ArrowUpRightIcon /></Button>
		<Button variant="outline" href="https://example.com">Learn more</Button>
	</div>
</Story>
