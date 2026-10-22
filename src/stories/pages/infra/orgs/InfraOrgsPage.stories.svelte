<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraOrgsPage from './InfraOrgsPage.svelte';
	import { orgRows, pageOf } from './fixtures';

	const { Story } = defineMeta({
		title: 'Pages/Infra/Organizations',
		component: InfraOrgsPage,
		tags: ['autodocs'],
		args: { onfilter: () => {} },
		parameters: {
			layout: 'fullscreen',
			docs: { subtitle: 'Every organization on the instance, searchable and filterable, for infrastructure admins.' }
		}
	});
</script>

<Story name="Organizations" args={{ page: pageOf(orgRows), filters: {} }} />

<Story name="No matches" args={{ page: pageOf([]), filters: { q: 'zzz' } }} />
