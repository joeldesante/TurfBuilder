<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PdfPage from './PdfPage.svelte';

	const { Story } = defineMeta({
		title: 'Components/Layout/Pdf Engine/Pdf Page',
		component: PdfPage,
		tags: ['autodocs']
	});
</script>

<Story name="Default" asChild>
	<PdfPage>
		{#snippet children()}
			<p>PDF page content goes here.</p>
		{/snippet}
	</PdfPage>
</Story>
