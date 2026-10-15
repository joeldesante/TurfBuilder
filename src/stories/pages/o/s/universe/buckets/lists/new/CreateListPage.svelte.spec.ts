import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import CreateListPage from './CreateListPage.svelte';

const peopleOnlyFilter = {
	people: { enabled: true },
	locations: { enabled: false }
};

const locationsOnlyFilter = {
	people: { enabled: false },
	locations: { enabled: true }
};

const bothFilter = {
	people: { enabled: true },
	locations: { enabled: true }
};

test('renders New List heading', async () => {
	const { getByRole } = render(CreateListPage, {
		props: { bucketName: 'Registered Voters', bucketFilter: peopleOnlyFilter, onCreate: async () => {} }
	});
	await expect.element(getByRole('heading', { name: 'New List' })).toBeVisible();
});

test('renders bucket name as subheading', async () => {
	const { getByText } = render(CreateListPage, {
		props: { bucketName: 'Registered Voters', bucketFilter: peopleOnlyFilter, onCreate: async () => {} }
	});
	await expect.element(getByText('Registered Voters')).toBeVisible();
});

test('shows only People radio when bucket has people only', async () => {
	const { getByRole, container } = render(CreateListPage, {
		props: { bucketName: 'Test', bucketFilter: peopleOnlyFilter, onCreate: async () => {} }
	});
	await expect.element(getByRole('radio', { name: 'People' })).toBeVisible();
	const allRadios = container.querySelectorAll('input[type="radio"]');
	expect(allRadios).toHaveLength(1);
});

test('shows only Locations radio when bucket has locations only', async () => {
	const { getByRole, container } = render(CreateListPage, {
		props: { bucketName: 'Test', bucketFilter: locationsOnlyFilter, onCreate: async () => {} }
	});
	await expect.element(getByRole('radio', { name: 'Locations' })).toBeVisible();
	const allRadios = container.querySelectorAll('input[type="radio"]');
	expect(allRadios).toHaveLength(1);
});

test('shows both radios when bucket includes both entity types', async () => {
	const { getByRole } = render(CreateListPage, {
		props: { bucketName: 'Test', bucketFilter: bothFilter, onCreate: async () => {} }
	});
	await expect.element(getByRole('radio', { name: 'People' })).toBeVisible();
	await expect.element(getByRole('radio', { name: 'Locations' })).toBeVisible();
});

test('pre-selects the only available type when there is one', async () => {
	const { getByRole } = render(CreateListPage, {
		props: { bucketName: 'Test', bucketFilter: peopleOnlyFilter, onCreate: async () => {} }
	});
	const radio = getByRole('radio', { name: 'People' });
	await expect.element(radio).toBeChecked();
});

test('renders name and expiration inputs', async () => {
	const { getByLabelText } = render(CreateListPage, {
		props: { bucketName: 'Test', bucketFilter: peopleOnlyFilter, onCreate: async () => {} }
	});
	await expect.element(getByLabelText('Name')).toBeVisible();
	await expect.element(getByLabelText('Expiration Date')).toBeVisible();
});

test('Create List button is disabled when name is empty', async () => {
	const { getByRole } = render(CreateListPage, {
		props: { bucketName: 'Test', bucketFilter: peopleOnlyFilter, onCreate: async () => {} }
	});
	await expect.element(getByRole('button', { name: 'Create List' })).toBeDisabled();
});

test('calls onCreate with correct payload', async () => {
	const onCreate = vi.fn().mockResolvedValue(undefined);

	const { getByLabelText, getByRole } = render(CreateListPage, {
		props: { bucketName: 'Test', bucketFilter: peopleOnlyFilter, onCreate }
	});

	await getByLabelText('Name').fill('My Test List');
	await getByLabelText('Expiration Date').fill('2027-01-01');
	await getByRole('button', { name: 'Create List' }).click();

	await vi.waitFor(() => expect(onCreate).toHaveBeenCalledOnce());

	const payload = onCreate.mock.calls[0][0];
	expect(payload.name).toBe('My Test List');
	expect(payload.entity_type).toBe('people');
	expect(payload.expires_at).toContain('2027-01-01');
	expect(payload.filters).toEqual({ operator: 'AND', filters: [] });
});

test('shows the filter editor for the kind of record chosen, with only its filters', async () => {
	const { getByRole } = render(CreateListPage, {
		props: { bucketName: 'Test', bucketFilter: peopleOnlyFilter, onCreate: async () => {} }
	});

	await getByRole('button', { name: 'Add Filter' }).click();

	await expect.element(getByRole('button', { name: /^Age/ })).toBeVisible();
	await expect.element(getByRole('button', { name: /^City/ })).not.toBeInTheDocument();
});

test('shows no filter editor until a kind of record is chosen', async () => {
	const { getByRole } = render(CreateListPage, {
		props: { bucketName: 'Test', bucketFilter: bothFilter, onCreate: async () => {} }
	});

	await expect.element(getByRole('button', { name: 'Add Filter' })).not.toBeInTheDocument();
	await getByRole('radio', { name: 'Locations' }).click();
	await expect.element(getByRole('button', { name: 'Add Filter' })).toBeVisible();
});

test('sends the filters added in the editor', async () => {
	const onCreate = vi.fn().mockResolvedValue(undefined);
	const { getByLabelText, getByRole } = render(CreateListPage, {
		props: { bucketName: 'Test', bucketFilter: locationsOnlyFilter, onCreate }
	});

	await getByLabelText('Name').fill('Austin');
	await getByLabelText('Expiration Date').fill('2027-01-01');
	await getByRole('button', { name: 'Add Filter' }).click();
	await getByRole('button', { name: /^City/ }).click();
	await getByRole('textbox', { name: 'Value' }).fill('Austin');
	await getByRole('button', { name: 'Add filter', exact: true }).click();
	await getByRole('button', { name: 'Create List' }).click();

	await vi.waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
	expect(onCreate.mock.calls[0][0].filters).toEqual({
		operator: 'AND',
		filters: [{ item: 'city', operation: 'equals', value: 'Austin' }]
	});
});

test('shows the error when creating fails', async () => {
	const onCreate = vi.fn().mockRejectedValue(new Error('This bucket does not include people'));
	const { getByLabelText, getByRole, getByText } = render(CreateListPage, {
		props: { bucketName: 'Test', bucketFilter: peopleOnlyFilter, onCreate }
	});

	await getByLabelText('Name').fill('List');
	await getByLabelText('Expiration Date').fill('2027-01-01');
	await getByRole('button', { name: 'Create List' }).click();

	await expect.element(getByText('This bucket does not include people')).toBeVisible();
});

test('says what the list will contain above the editor', async () => {
	const { getByText } = render(CreateListPage, {
		props: { bucketName: 'Test', bucketFilter: peopleOnlyFilter, onCreate: async () => {} }
	});

	await expect.element(getByText('This list will contain')).toBeVisible();
});
