import { render } from 'vitest-browser-svelte';
import { expect, test, vi, beforeEach } from 'vitest';
import MetricsWorkflowSidebar from './MetricsWorkflowSidebar.svelte';

const buckets = [
	{ id: 'bucket-1', name: 'Likely Voters', slug: 'likely-voters' },
	{ id: 'bucket-2', name: 'Volunteers', slug: 'volunteers' }
];

const surveys = [
	{ id: 'survey-1', name: 'Doorstep Survey' },
	{ id: 'survey-2', name: 'Follow-up Survey' }
];

beforeEach(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(JSON.stringify(surveys)))
	);
});

test('only shows the bucket selector until a bucket is chosen', async () => {
	const { getByLabelText, getByRole } = render(MetricsWorkflowSidebar, {
		props: { buckets, onGenerate: () => {} }
	});

	await expect.element(getByLabelText('Bucket')).toBeVisible();
	await expect.element(getByLabelText('Survey')).not.toBeInTheDocument();
	await expect.element(getByRole('button', { name: 'View Results' })).not.toBeInTheDocument();
});

test('reveals the survey selector after choosing a bucket', async () => {
	const { getByLabelText } = render(MetricsWorkflowSidebar, {
		props: { buckets, onGenerate: () => {} }
	});

	await getByLabelText('Bucket').selectOptions('bucket-1');

	await expect.element(getByLabelText('Survey')).toBeVisible();
	expect(fetch).toHaveBeenCalledWith('/api/v1/buckets/bucket-1/surveys', expect.anything());
});

test('reveals the date range and generate button after choosing a survey', async () => {
	const { getByLabelText, getByRole, getByText } = render(MetricsWorkflowSidebar, {
		props: { buckets, onGenerate: () => {} }
	});

	await getByLabelText('Bucket').selectOptions('bucket-1');
	await expect.element(getByLabelText('Survey')).toBeVisible();
	await getByLabelText('Survey').selectOptions('survey-1');

	await expect.element(getByText('From', { exact: true })).toBeVisible();
	await expect.element(getByText('To', { exact: true })).toBeVisible();
	await expect.element(getByRole('button', { name: 'View Results' })).toBeVisible();
});

test('calls onGenerate with the selected bucket and survey', async () => {
	const onGenerate = vi.fn();
	const { getByLabelText, getByRole } = render(MetricsWorkflowSidebar, {
		props: { buckets, onGenerate }
	});

	await getByLabelText('Bucket').selectOptions('bucket-1');
	await expect.element(getByLabelText('Survey')).toBeVisible();
	await getByLabelText('Survey').selectOptions('survey-1');
	await expect.element(getByRole('button', { name: 'View Results' })).toBeVisible();

	await getByRole('button', { name: 'View Results' }).click();

	expect(onGenerate).toHaveBeenCalledWith({
		bucketId: 'bucket-1',
		surveyId: 'survey-1',
		startDate: null,
		endDate: null
	});
});
