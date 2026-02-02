<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf'
	import Pin from './Pin.svelte'

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/Pin',
		component: Pin,
		args: {
			length: 6
		}
	})
</script>

<Story name="Default (6 digits)" />

<Story name="Short (4 digits)" args={{ length: 4 }} />
