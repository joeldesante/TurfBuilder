import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import Terms from './Terms.svelte';

test('renders Terms of Service heading', async () => {
	const { getByRole } = render(Terms);
	await expect.element(getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
});

test('renders key sections', async () => {
	const { getByRole } = render(Terms);
	await expect.element(getByRole('heading', { name: 'Acceptance of Terms' })).toBeVisible();
	await expect.element(getByRole('heading', { name: 'Acceptable Use' })).toBeVisible();
	await expect.element(getByRole('heading', { name: 'Data and Privacy' })).toBeVisible();
});

test('links to privacy policy', async () => {
	const { getByRole } = render(Terms);
	await expect.element(getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
});
