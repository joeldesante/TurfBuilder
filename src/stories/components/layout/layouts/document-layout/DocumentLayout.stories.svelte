<script module lang="ts">
	export const meta = {
		title: 'Layout/DocumentLayout',
		component: DocumentLayout
	};
</script>

<script lang="ts">
	import { Story } from '@storybook/addon-svelte-csf';
	import DocumentLayout from './DocumentLayout.svelte';
</script>

<Story name="Default">
	<DocumentLayout title="Example Document" lastUpdated="January 1, 2025">
		{#snippet children()}
			<h2>Introduction</h2>
			<p>
				This is an example document to demonstrate the DocumentLayout component. It provides a
				consistent structure for legal and informational pages.
			</p>
			<h2>Section One</h2>
			<p>
				Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
				labore et dolore magna aliqua.
			</p>
			<ul>
				<li>First item in a list</li>
				<li>Second item in a list</li>
				<li>Third item in a list</li>
			</ul>
			<h2>Section Two</h2>
			<p>
				Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
				commodo consequat.
			</p>
		{/snippet}
	</DocumentLayout>
</Story>

<Story name="Without Last Updated">
	<DocumentLayout title="Simple Document">
		{#snippet children()}
			<h2>Content</h2>
			<p>A document without a last updated date.</p>
		{/snippet}
	</DocumentLayout>
</Story>
