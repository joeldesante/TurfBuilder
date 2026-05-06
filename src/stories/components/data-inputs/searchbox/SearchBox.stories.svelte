<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SearchBox from './SearchBox.svelte';

	const HISTORY_KEY = 'search_history:demo-org';

	const mockHistory = [
		{ title: 'Downtown Survey', subtitle: 'Door-to-door in Precinct 4', href: '/o/demo-org/s/data/surveys' },
		{ title: 'Jane Smith', subtitle: 'jane@example.com', href: '/o/demo-org/s/members/1' },
		{ title: 'TURF-001', subtitle: '', href: '/o/demo-org/s/turfs' },
	];

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/SearchBox',
		component: SearchBox,
		tags: ['autodocs'],
		parameters: {
			docs: {
				subtitle: 'Cmd+K quick search across surveys, turfs, members, and locations. Results are org-scoped and permission-gated.'
			},
			layout: 'padded',
			sveltekit_experimental: {
				stores: {
					page: {
						params: { org_slug: 'demo-org' },
						data: { organization: { name: 'Demo Organization' } }
					}
				}
			}
		}
	});
</script>

<Story name="Empty" />

<Story
	name="With Recent History"
	decorators={[
		() => {
			localStorage.setItem(HISTORY_KEY, JSON.stringify(mockHistory));
			return {};
		}
	]}
/>

<Story
	name="No Org Context"
	parameters={{
		sveltekit_experimental: {
			stores: {
				page: { params: {}, data: {} }
			}
		}
	}}
/>
