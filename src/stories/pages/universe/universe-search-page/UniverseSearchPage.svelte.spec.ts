import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import UniverseSearchPage from './UniverseSearchPage.svelte';

test('renders header', async () => {
	const { getByRole } = render(UniverseSearchPage, { props: { orgSlug: 'test-org' } });
	await expect.element(getByRole('heading', { name: 'Quick Search' })).toBeVisible();
});

test('shows run button disabled with empty query', async () => {
	const { getByRole } = render(UniverseSearchPage, { props: { orgSlug: 'test-org' } });
	const runButton = getByRole('button', { name: 'Run' });
	await expect.element(runButton).toBeDisabled();
});

test('add query button appends a second query block', async () => {
	const { getByRole, getByText } = render(UniverseSearchPage, { props: { orgSlug: 'test-org' } });
	const addQuery = getByRole('button', { name: '+ Add Query' });
	await addQuery.click();
	await expect.element(getByText('Query 2')).toBeVisible();
});
