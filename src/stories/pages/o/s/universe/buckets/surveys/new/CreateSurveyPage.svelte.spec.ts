import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import CreateSurveyPage from './CreateSurveyPage.svelte';

test('renders name field and submit button', async () => {
	const { getByLabelText, getByRole } = render(CreateSurveyPage, { props: { onCreate: vi.fn() } });
	await expect.element(getByLabelText('Name')).toBeVisible();
	await expect.element(getByRole('button', { name: 'Create Survey' })).toBeVisible();
});

test('does not call onCreate and shows an error when the name is empty', async () => {
	const onCreate = vi.fn();
	const { getByRole, getByText } = render(CreateSurveyPage, { props: { onCreate } });
	await getByRole('button', { name: 'Create Survey' }).click();
	await expect.element(getByText('Enter a name')).toBeVisible();
	expect(onCreate).not.toHaveBeenCalled();
});

test('does not call onCreate when the name is only spaces', async () => {
	const onCreate = vi.fn();
	const { getByLabelText, getByRole, getByText } = render(CreateSurveyPage, { props: { onCreate } });
	await getByLabelText('Name').fill('   ');
	await getByRole('button', { name: 'Create Survey' }).click();
	await expect.element(getByText('Enter a name')).toBeVisible();
	expect(onCreate).not.toHaveBeenCalled();
});

test('calls onCreate with the trimmed name', async () => {
	const onCreate = vi.fn().mockResolvedValue(undefined);
	const { getByLabelText, getByRole } = render(CreateSurveyPage, { props: { onCreate } });

	await getByLabelText('Name').fill('  Door Knock Survey  ');
	await getByRole('button', { name: 'Create Survey' }).click();

	await vi.waitFor(() => {
		expect(onCreate).toHaveBeenCalledWith('Door Knock Survey');
	});
});

test('shows the error when onCreate rejects', async () => {
	const onCreate = vi.fn().mockRejectedValue(new Error('Name already taken.'));
	const { getByLabelText, getByRole, getByText } = render(CreateSurveyPage, { props: { onCreate } });

	await getByLabelText('Name').fill('Test');
	await getByRole('button', { name: 'Create Survey' }).click();

	await expect.element(getByText('Name already taken.')).toBeVisible();
});
