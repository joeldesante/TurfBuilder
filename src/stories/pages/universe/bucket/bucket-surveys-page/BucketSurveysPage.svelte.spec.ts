import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import BucketSurveysPage from './BucketSurveysPage.svelte';

const baseProps = {
	bucketName: 'Registered Voters',
	bucketSlug: 'registered-voters',
	orgSlug: 'test-org',
	surveys: []
};

test('renders Surveys heading', async () => {
	const { getByRole } = render(BucketSurveysPage, { props: baseProps });
	await expect.element(getByRole('heading', { name: 'Surveys' })).toBeVisible();
});

test('renders bucket name as subheading', async () => {
	const { getByText } = render(BucketSurveysPage, { props: baseProps });
	await expect.element(getByText('Registered Voters')).toBeVisible();
});

test('renders empty state when no surveys', async () => {
	const { getByText } = render(BucketSurveysPage, { props: baseProps });
	await expect.element(getByText('No surveys yet.')).toBeVisible();
});

test('renders survey rows', async () => {
	const { getByText } = render(BucketSurveysPage, {
		props: {
			...baseProps,
			surveys: [{ id: '1', name: 'Voter Contact Survey', updated_at: new Date().toISOString() }]
		}
	});
	await expect.element(getByText('Voter Contact Survey')).toBeVisible();
});
