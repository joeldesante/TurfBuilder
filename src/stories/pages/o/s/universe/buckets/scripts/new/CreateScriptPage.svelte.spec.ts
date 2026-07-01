import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import CreateScriptPage from './CreateScriptPage.svelte';

test('renders name field and submit button', async () => {
	const { getByLabelText, getByRole } = render(CreateScriptPage, { props: { onCreate: vi.fn() } });
	await expect.element(getByLabelText('Name')).toBeVisible();
	await expect.element(getByRole('button', { name: 'Create Script' })).toBeVisible();
});

test('submit button is disabled when name is empty', async () => {
	const { getByRole } = render(CreateScriptPage, { props: { onCreate: vi.fn() } });
	await expect.element(getByRole('button', { name: 'Create Script' })).toBeDisabled();
});

test('calls onCreate with the script name', async () => {
	const onCreate = vi.fn().mockResolvedValue(undefined);
	const { getByLabelText, getByRole } = render(CreateScriptPage, { props: { onCreate } });

	await getByLabelText('Name').fill('Door Knock Script');
	await getByRole('button', { name: 'Create Script' }).click();

	await vi.waitFor(() => {
		expect(onCreate).toHaveBeenCalledWith('Door Knock Script');
	});
});

test('shows error when onCreate rejects', async () => {
	const onCreate = vi.fn().mockRejectedValue(new Error('Name already taken.'));
	const { getByLabelText, getByRole, getByText } = render(CreateScriptPage, { props: { onCreate } });

	await getByLabelText('Name').fill('Test');
	await getByRole('button', { name: 'Create Script' }).click();

	await expect.element(getByText('Name already taken.')).toBeVisible();
});
