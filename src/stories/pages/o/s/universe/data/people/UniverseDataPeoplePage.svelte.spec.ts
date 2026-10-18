import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import UniverseDataPeoplePage from './UniverseDataPeoplePage.svelte';

const people = [
	{ id: '1', first_name: 'Alice', last_name: 'Johnson', email: 'alice@example.com', phone: '555-0101', dob: '1985-04-12' },
	{ id: '2', first_name: 'Bob', last_name: 'Smith', email: null, phone: '555-0102', dob: null }
];

const base = { orgSlug: 'acme', people, totalCount: 2 };

test('lists each person with a link to their profile', async () => {
	const { getByRole } = render(UniverseDataPeoplePage, { props: base });

	await expect
		.element(getByRole('link', { name: /Alice Johnson/ }))
		.toHaveAttribute('href', '/o/acme/s/universe/people/1');
	await expect.element(getByRole('link', { name: /Bob Smith/ })).toBeVisible();
});

test('shows the empty state', async () => {
	const { getByText } = render(UniverseDataPeoplePage, {
		props: { ...base, people: [], totalCount: 0 }
	});

	await expect.element(getByText('No people records found.')).toBeVisible();
});

test('summarizes the page', async () => {
	const { getByText, getByRole } = render(UniverseDataPeoplePage, {
		props: { ...base, totalCount: 5400, page: 3, pageSize: 2 }
	});

	await expect.element(getByText(/Showing 5–6 of 5,400 records\./).first()).toBeVisible();
	await expect.element(getByRole('link', { name: 'Quick Search' })).not.toBeInTheDocument();
});

test('links to the neighboring pages', async () => {
	const { getByRole } = render(UniverseDataPeoplePage, {
		props: { ...base, totalCount: 5400, page: 3, pageSize: 2 }
	});

	await expect.element(getByRole('link', { name: 'Previous page' }).first()).toHaveAttribute('href', '?page=2');
	await expect.element(getByRole('link', { name: 'Next page' }).first()).toHaveAttribute('href', '?page=4');
});
