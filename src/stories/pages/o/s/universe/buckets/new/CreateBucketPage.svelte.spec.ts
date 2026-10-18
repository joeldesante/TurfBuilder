import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import CreateBucketPage from './CreateBucketPage.svelte';

function setup(onCreate = vi.fn().mockResolvedValue(undefined)) {
	const screen = render(CreateBucketPage, { props: { onCreate } });
	return { screen, onCreate };
}

test('renders name field and submit button', async () => {
	const { screen } = setup();

	await expect.element(screen.getByLabelText('Name')).toBeVisible();
	await expect.element(screen.getByRole('button', { name: 'Create Bucket' })).toBeVisible();
});

test('submit button is disabled when name is empty', async () => {
	const { screen } = setup();

	await expect.element(screen.getByRole('button', { name: 'Create Bucket' })).toBeDisabled();
});

test('submit button is disabled until a kind of record is included', async () => {
	const { screen } = setup();

	await screen.getByLabelText('Name').fill('Voters');
	await expect.element(screen.getByRole('button', { name: 'Create Bucket' })).toBeDisabled();

	await screen.getByRole('checkbox', { name: 'Locations' }).click();
	await expect.element(screen.getByRole('button', { name: 'Create Bucket' })).toBeEnabled();
});

test('shows a filter editor for each kind of record included', async () => {
	const { screen } = setup();

	await expect.element(screen.getByRole('region', { name: 'Locations filters' })).not.toBeInTheDocument();
	await screen.getByRole('checkbox', { name: 'Locations' }).click();

	await expect.element(screen.getByRole('region', { name: 'Locations filters' })).toBeVisible();
});

test('does not offer people, which are not supported yet', async () => {
	const { screen } = setup();

	await expect.element(screen.getByRole('checkbox', { name: 'People' })).not.toBeInTheDocument();
});

test('offers the editor only the filters for locations', async () => {
	const { screen } = setup();

	await screen.getByRole('checkbox', { name: 'Locations' }).click();
	await screen.getByRole('button', { name: 'Add Filter' }).click();

	await expect.element(screen.getByRole('button', { name: /^City/ })).toBeVisible();
	await expect.element(screen.getByRole('button', { name: /^Age/ })).not.toBeInTheDocument();
});

test('calls onCreate with the name, derived slug, and filters for the kinds included', async () => {
	const { screen, onCreate } = setup();

	await screen.getByLabelText('Name').fill('Registered Voters');
	await screen.getByRole('checkbox', { name: 'Locations' }).click();
	await screen.getByRole('button', { name: 'Create Bucket' }).click();

	await vi.waitFor(() =>
		expect(onCreate).toHaveBeenCalledWith('Registered Voters', 'registered-voters', {
			v: 2,
			people: null,
			locations: { operator: 'AND', filters: [] }
		})
	);
});

test('includes the filters added in the editor', async () => {
	const { screen, onCreate } = setup();

	await screen.getByLabelText('Name').fill('Austin');
	await screen.getByRole('checkbox', { name: 'Locations' }).click();
	await screen.getByRole('button', { name: 'Add Filter' }).click();
	await screen.getByRole('button', { name: /^City/ }).click();
	await screen.getByRole('textbox', { name: 'Value' }).fill('Austin');
	await screen.getByRole('button', { name: 'Add filter', exact: true }).click();
	await screen.getByRole('button', { name: 'Create Bucket' }).click();

	await vi.waitFor(() =>
		expect(onCreate).toHaveBeenCalledWith('Austin', 'austin', {
			v: 2,
			people: null,
			locations: { operator: 'AND', filters: [{ item: 'city', operation: 'equals', value: 'Austin' }] }
		})
	);
});

test('shows error message when onCreate rejects', async () => {
	const { screen } = setup(vi.fn().mockRejectedValue(new Error('A bucket with that slug already exists')));

	await screen.getByLabelText('Name').fill('Duplicate');
	await screen.getByRole('checkbox', { name: 'Locations' }).click();
	await screen.getByRole('button', { name: 'Create Bucket' }).click();

	await expect.element(screen.getByText('A bucket with that slug already exists')).toBeVisible();
});

test('says what the bucket will contain above each editor', async () => {
	const { screen } = setup();

	await screen.getByRole('checkbox', { name: 'Locations' }).click();

	await expect.element(screen.getByText('This bucket will contain')).toBeVisible();
});
