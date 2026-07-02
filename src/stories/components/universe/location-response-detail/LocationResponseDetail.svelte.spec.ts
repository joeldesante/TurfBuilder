import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import LocationResponseDetail from './LocationResponseDetail.svelte';

const location = {
	id: 'public:loc-1',
	name: 'Community Center',
	address_line_1: '100 Main St',
	city: 'Philadelphia',
	latitude: 40.0259,
	longitude: -75.2238,
	questions: [
		{
			id: 'q1',
			text: 'Will you vote in the upcoming election?',
			type: 'single_choice',
			choices: ['Yes', 'No'],
			responses: [{ value: 'Yes', respondedAt: '2026-06-01T14:32:00.000Z', respondedBy: 'alice' }]
		},
		{
			id: 'q2',
			text: 'Any concerns?',
			type: 'text',
			choices: [],
			responses: []
		}
	]
};

test('renders the location name and address', async () => {
	const { getByText } = render(LocationResponseDetail, {
		props: { location, onClose: () => {} }
	});

	await expect.element(getByText('Community Center')).toBeVisible();
	await expect.element(getByText('100 Main St, Philadelphia')).toBeVisible();
});

test('renders each question with its responses', async () => {
	const { getByText } = render(LocationResponseDetail, {
		props: { location, onClose: () => {} }
	});

	await expect.element(getByText('Will you vote in the upcoming election?')).toBeVisible();
	await expect.element(getByText('Yes')).toBeVisible();
	await expect.element(getByText(/alice/)).toBeVisible();
});

test('shows a placeholder when a question has no responses', async () => {
	const { getByText } = render(LocationResponseDetail, {
		props: { location, onClose: () => {} }
	});

	await expect.element(getByText('No responses yet.')).toBeVisible();
});

test('shows a placeholder when the location has no questions at all', async () => {
	const { getByText } = render(LocationResponseDetail, {
		props: {
			location: { ...location, questions: [] },
			onClose: () => {}
		}
	});

	await expect.element(getByText('No responses recorded for this location.')).toBeVisible();
});

test('calls onClose when the close button is clicked', async () => {
	const onClose = vi.fn();
	const { getByRole } = render(LocationResponseDetail, {
		props: { location, onClose }
	});

	await getByRole('button', { name: 'Close location details' }).click();

	expect(onClose).toHaveBeenCalledTimes(1);
});
