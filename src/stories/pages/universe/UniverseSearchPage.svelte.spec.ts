import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import UniverseSearchPage from './UniverseSearchPage.svelte';

test('renders header', async () => {
	const { getByRole } = render(UniverseSearchPage);
	await expect.element(getByRole('heading', { name: 'Search your Universe' })).toBeVisible();
});
