<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PdfLayout from './PdfLayout.svelte';

	const { Story } = defineMeta({
		title: 'Components/Layout/Pdf Engine/Pdf Layout',
		component: PdfLayout,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen'
		}
	});
</script>

<Story name="Single Page" asChild>
	{#snippet children()}
		{#snippet page()}
			<h1>Page One</h1>
			<p>This is the content of the first page.</p>
		{/snippet}
		<PdfLayout pages={[page]} />
	{/snippet}
</Story>

<Story name="Multiple Pages" asChild>
	{#snippet children()}
		{#snippet page1()}
			<h1>Page One</h1>
			<p>This is the content of the first page.</p>
		{/snippet}
		{#snippet page2()}
			<h1>Page Two</h1>
			<p>This is the content of the second page.</p>
		{/snippet}
		{#snippet page3()}
			<h1>Page Three</h1>
			<p>This is the content of the third page.</p>
		{/snippet}
		<PdfLayout pages={[page1, page2, page3]} />
	{/snippet}
</Story>
