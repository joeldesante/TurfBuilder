import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import UniverseScriptsPage from './UniverseScriptsPage.svelte';

test('renders heading', async () => {
	const { getByRole } = render(UniverseScriptsPage);
	await expect.element(getByRole('heading', { name: 'Scripts' })).toBeVisible();
});
