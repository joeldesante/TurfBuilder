<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CodeEditor from './CodeEditor.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data inputs/Code editor',
		component: CodeEditor,
		tags: ['autodocs'],
		parameters: {
			docs: { subtitle: 'A syntax-highlighted editor for HTML, such as an email body or a script added to every page.' }
		}
	});
</script>

<Story name="HTML" args={{ label: 'Email body', value: '<p>Hi {{username}},</p>\n<p><a href="{{reset_url}}">Reset password</a></p>' }} />

<Story name="Read only" args={{ label: 'Default body', value: '<p>Hello</p>', readonly: true }} />

<Story name="Empty" args={{ label: 'Header HTML', value: '', minHeight: 120 }} />
