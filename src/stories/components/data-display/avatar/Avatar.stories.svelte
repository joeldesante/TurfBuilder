<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import Avatar from './Avatar.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Display/Avatar',
		component: Avatar,
		tags: ['autodocs'],
		argTypes: {
			variant: {
				control: { type: 'radio' },
				options: ['default', 'primary']
			},
			size: {
				control: { type: 'radio' },
				options: ['sm', 'md', 'lg']
			}
		}
	})
</script>

<Story name="Default" args={{ username: 'Jane Doe' }} />

<Story name="Primary" args={{ username: 'Jane Doe', variant: 'primary' }} />

<Story name="Sizes" asChild>
	<div class="flex items-center gap-4">
		<Avatar username="Jane Doe" size="sm" />
		<Avatar username="Jane Doe" size="md" />
		<Avatar username="Jane Doe" size="lg" />
	</div>
</Story>
