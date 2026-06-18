import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import CreateSurveyPage from './CreateSurveyPage.svelte';

test('renders the form heading', async () => {
	const { getByText } = render(CreateSurveyPage, { props: { onCreate: vi.fn() } });
	await expect.element(getByText('New Survey')).toBeVisible();
});

test('submit button is disabled when name is empty', async () => {
	const { getByRole } = render(CreateSurveyPage, { props: { onCreate: vi.fn() } });
	const btn = getByRole('button', { name: 'Create Survey' });
	await expect.element(btn).toBeDisabled();
});

test('submit button is enabled when name is filled', async () => {
	const { getByRole, getByLabelText } = render(CreateSurveyPage, { props: { onCreate: vi.fn() } });
	await getByLabelText('Name').fill('My Survey');
	const btn = getByRole('button', { name: 'Create Survey' });
	await expect.element(btn).not.toBeDisabled();
});

test('calls onCreate with the name on submit', async () => {
	const onCreate = vi.fn().mockResolvedValue(undefined);
	const { getByRole, getByLabelText } = render(CreateSurveyPage, { props: { onCreate } });
	await getByLabelText('Name').fill('My Survey');
	await getByRole('button', { name: 'Create Survey' }).click();
	expect(onCreate).toHaveBeenCalledWith('My Survey');
});
