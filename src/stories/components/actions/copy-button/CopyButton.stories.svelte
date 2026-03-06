<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CopyButton from './CopyButton.svelte';

	const { Story } = defineMeta({
		title: 'Components/Actions/CopyButton',
		component: CopyButton,
		tags: ['autodocs'],
		argTypes: {
			value: {
				control: 'text',
				description: 'The string to copy to the clipboard when clicked.'
			},
			'aria-label': {
				control: 'text',
				description: 'Accessible label for the button. Defaults to "Copy to clipboard".'
			},
			class: {
				control: false,
				description: 'Additional CSS classes to apply to the button.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					'A ghost icon button that copies a string to the clipboard, showing a checkmark confirmation for 2 seconds.'
			}
		}
	});
</script>

<Story name="Default" args={{ value: 'Hello, world!' }} />

<Story
	name="Custom Aria Label"
	args={{ value: 'npm install', 'aria-label': 'Copy install command' }}
/>
