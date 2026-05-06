import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import UniverseDataManagerPage from './UniverseDataManagerPage.svelte';

test('renders heading', async () => {
	const { getByRole } = render(UniverseDataManagerPage);
	await expect.element(getByRole('heading', { name: 'Universe Data Manager' })).toBeVisible();
});
