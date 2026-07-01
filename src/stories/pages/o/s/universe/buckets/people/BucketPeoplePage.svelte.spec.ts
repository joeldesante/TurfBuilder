import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import BucketPeoplePage from './BucketPeoplePage.svelte';

const samplePeople = [
	{ id: '1', first_name: 'Alice', last_name: 'Johnson', email: 'alice@example.com', phone: '555-0101', dob: '1985-04-12' },
	{ id: '2', first_name: 'Bob', last_name: 'Smith', email: null, phone: '555-0102', dob: null }
];

test('renders heading and bucket name', async () => {
	const { getByRole, getByText } = render(BucketPeoplePage, {
		props: { bucketName: 'Registered Voters', enabled: true, people: samplePeople }
	});
	await expect.element(getByRole('heading', { name: 'People' })).toBeVisible();
	await expect.element(getByText('Registered Voters')).toBeVisible();
});

test('shows people rows when results are present', async () => {
	const { getByText } = render(BucketPeoplePage, {
		props: { bucketName: 'Registered Voters', enabled: true, people: samplePeople }
	});
	await expect.element(getByText('Alice Johnson')).toBeVisible();
	await expect.element(getByText('Bob Smith')).toBeVisible();
});

test('shows match count', async () => {
	const { getByText } = render(BucketPeoplePage, {
		props: { bucketName: 'Registered Voters', enabled: true, people: samplePeople }
	});
	await expect.element(getByText('2 people matched')).toBeVisible();
});

test('shows empty state when no people match', async () => {
	const { getByText } = render(BucketPeoplePage, {
		props: { bucketName: 'Registered Voters', enabled: true, people: [] }
	});
	await expect.element(getByText(/no people match/i)).toBeVisible();
});

test('shows not-enabled state when people filter is off', async () => {
	const { getByText } = render(BucketPeoplePage, {
		props: { bucketName: 'Locations Only', enabled: false, people: [] }
	});
	await expect.element(getByText(/does not include a people filter/i)).toBeVisible();
});
