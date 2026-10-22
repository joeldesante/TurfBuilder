<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import RangePicker from './RangePicker.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/RangePicker',
		component: RangePicker,
		tags: ['autodocs'],
		args: { onchange: () => {} },
		parameters: {
			docs: {
				subtitle:
					'The time range and bucket size for a page of charts. Ranges use the dashboard range format (7d, 30d, 1y, all); picking one brings its usual bucket size. Keep the value in the URL.'
			}
		}
	});
</script>

<Story name="Default" args={{ range: '30d', granularity: 'day' }} />

<Story name="Range only" args={{ range: '90d', granularity: 'week', showGranularity: false }} />
