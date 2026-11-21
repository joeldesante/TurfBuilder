import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import OfficialBadge from './OfficialBadge.svelte';

describe('OfficialBadge', () => {
	it('says the layer is official', async () => {
		render(OfficialBadge);

		await expect.element(page.getByText('Official')).toBeVisible();
	});

	it('explains what counts as official when hovered', async () => {
		render(OfficialBadge);

		await page.getByText('Official').hover();

		await expect.element(page.getByText(/city, county,\s+state, tribal or federal/)).toBeVisible();
		await expect.element(page.getByText(/elsewhere are not\s+marked official/)).toBeVisible();
		await expect.element(page.getByText('What makes a layer official')).not.toBeInTheDocument();
	});

	it('explains it for a keyboard user who focuses the badge', async () => {
		render(OfficialBadge);

		(page.getByText('Official').element() as HTMLElement).focus();

		await expect.element(page.getByText(/city, county,\s+state, tribal or federal/)).toBeVisible();
	});
});
