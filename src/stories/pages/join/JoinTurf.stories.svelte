<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import JoinTurf from './JoinTurf.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Join/JoinTurf',
		component: JoinTurf,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle:
					'Entry page for canvassers to enter a 6-character turf code and be routed to their org map.'
			}
		}
	});

	function noop() {
		return Promise.resolve();
	}

	async function simulateError() {
		await new Promise((_, reject) => setTimeout(() => reject(new Error('not found')), 800));
	}
</script>

<Story name="Default" args={{ onJoin: noop }} />

<Story name="Simulated Error" args={{ onJoin: simulateError }} />
