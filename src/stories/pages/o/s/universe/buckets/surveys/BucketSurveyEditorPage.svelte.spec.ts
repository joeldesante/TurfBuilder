import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import BucketSurveyEditorPage from './BucketSurveyEditorPage.svelte';

const baseProps = {
	surveyName: 'Test Survey',
	surveyDescription: 'A test survey.',
	bucketName: 'Test Bucket',
	questions: [],
	onSave: vi.fn().mockResolvedValue(undefined)
};

test('renders survey name in page header', async () => {
	const { getByText } = render(BucketSurveyEditorPage, { props: baseProps });
	await expect.element(getByText('Test Survey')).toBeVisible();
});

test('renders bucket name as subheading', async () => {
	const { getByText } = render(BucketSurveyEditorPage, { props: baseProps });
	await expect.element(getByText('Test Bucket')).toBeVisible();
});

test('shows Saved status by default', async () => {
	const { getByText } = render(BucketSurveyEditorPage, { props: baseProps });
	await expect.element(getByText('Saved')).toBeVisible();
});

test('renders delete button for each question', async () => {
	const { getByRole } = render(BucketSurveyEditorPage, {
		props: {
			...baseProps,
			questions: [{ db_id: '1', type: 'text', text: 'What is your concern?', choices: [], index: 0 }]
		}
	});
	await expect.element(getByRole('button', { name: 'Delete' })).toBeVisible();
});

test('add question button is rendered', async () => {
	const { getByRole } = render(BucketSurveyEditorPage, { props: baseProps });
	await expect.element(getByRole('button', { name: 'Add Question' })).toBeVisible();
});
