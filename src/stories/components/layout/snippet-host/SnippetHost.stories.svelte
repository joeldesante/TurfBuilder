<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { Snippet } from 'svelte';
	import SnippetHost from './SnippetHost.svelte';

	const { Story } = defineMeta({
		title: 'Components/Layout/Snippet Host',
		component: SnippetHost,
		tags: ['autodocs'],
		parameters: {
			docs: {
				subtitle:
					'Renders a snippet with one argument, for code that mounts content by hand, such as map popups.'
			}
		}
	});
</script>

{#snippet greeting(name: string)}
	<p class="text-sm text-on-surface">Hello, {name}</p>
{/snippet}

<Story name="Default" args={{ snippet: greeting as Snippet<[unknown]>, arg: 'Ward 5' }} />
