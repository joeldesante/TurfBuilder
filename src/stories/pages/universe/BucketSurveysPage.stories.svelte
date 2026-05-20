<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BucketSurveysPage from './BucketSurveysPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/BucketSurveys',
		component: BucketSurveysPage,
		tags: ['autodocs']
	});
</script>

<Story name="Default" args={{ bucketName: 'Registered Voters' }} />
