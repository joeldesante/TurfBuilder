import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import CreateListPage from './CreateListPage.svelte';

const peopleOnlyFilter = {
	v: 1 as const,
	people: { enabled: true, query: null },
	locations: { enabled: false, query: null }
};

const locationsOnlyFilter = {
	v: 1 as const,
	people: { enabled: false, query: null },
	locations: { enabled: true, query: null }
};

const bothFilter = {
	v: 1 as const,
	people: { enabled: true, query: null },
	locations: { enabled: true, query: null }
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
});
