<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraUsersPage from './InfraUsersPage.svelte';
	import { pageOf, userRows } from './fixtures';

	const { Story } = defineMeta({
		title: 'Pages/Infra/Users',
		component: InfraUsersPage,
		tags: ['autodocs'],
		args: { onfilter: () => {} },
		parameters: {
			layout: 'fullscreen',
			docs: { subtitle: 'Every account on the instance, searchable and filterable, for infrastructure admins.' }
		}
	});
</script>

<Story name="Users" args={{ page: pageOf(userRows, 100), filters: {} }} />

<Story name="No matches" args={{ page: pageOf([], 100), filters: { q: 'zzz' } }} />
