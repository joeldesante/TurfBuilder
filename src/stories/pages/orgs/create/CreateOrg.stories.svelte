<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CreateOrg from './CreateOrg.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Orgs/CreateOrg',
		component: CreateOrg,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle: 'Form for creating a new organization. Slug is auto-derived from the name.'
			}
		}
	});

	function noop() {
		return Promise.resolve();
	}

	async function simulateError() {
		await new Promise((_, reject) =>
			setTimeout(() => reject(new Error('That slug is already taken.')), 600)
		);
	}
</script>

<Story name="Default" args={{ onCreate: noop }} />

<Story name="Slug Already Taken" args={{ onCreate: simulateError }} />
