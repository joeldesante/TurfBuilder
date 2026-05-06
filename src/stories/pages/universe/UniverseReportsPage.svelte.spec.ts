import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import UniverseReportsPage from './UniverseReportsPage.svelte';

test('renders heading', async () => {
	const { getByRole } = render(UniverseReportsPage);
	await expect.element(getByRole('heading', { name: 'Reports' })).toBeVisible();
});
