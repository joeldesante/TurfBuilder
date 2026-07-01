import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import CreateBucketPage from './CreateBucketPage.svelte';

test('renders name field and submit button', async () => {
	const { getByLabelText, getByRole } = render(CreateBucketPage, {
		props: { onCreate: vi.fn() }
	});
	await expect.element(getByLabelText('Name')).toBeVisible();
	await expect.element(getByRole('button', { name: 'Create Bucket' })).toBeVisible();
});

test('submit button is disabled when name is empty', async () => {
	const { getByRole } = render(CreateBucketPage, {
		props: { onCreate: vi.fn() }
	});
	await expect.element(getByRole('button', { name: 'Create Bucket' })).toBeDisabled();
});

test('calls onCreate with name, derived slug, and filter object', async () => {
	const onCreate = vi.fn().mockResolvedValue(undefined);
	const { getByLabelText, getByRole } = render(CreateBucketPage, { props: { onCreate } });

	const input = getByLabelText('Name');
	await input.fill('Registered Voters');
	await getByRole('button', { name: 'Create Bucket' }).click();

	await vi.waitFor(() => {
		expect(onCreate).toHaveBeenCalledWith(
			'Registered Voters',
			'registered-voters',
			expect.objectContaining({
				people: expect.objectContaining({ enabled: false }),
				locations: expect.objectContaining({ enabled: false })
			})
		);
	});
});

test('shows error message when onCreate rejects', async () => {
	const onCreate = vi.fn().mockRejectedValue(new Error('A bucket with that name already exists.'));
	const { getByLabelText, getByRole, getByText } = render(CreateBucketPage, { props: { onCreate } });

	await getByLabelText('Name').fill('Duplicate');
	await getByRole('button', { name: 'Create Bucket' }).click();

	await expect.element(getByText('A bucket with that name already exists.')).toBeVisible();
});
