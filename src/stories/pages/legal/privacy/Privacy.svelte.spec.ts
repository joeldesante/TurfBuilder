import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import Privacy from './Privacy.svelte';

test('renders Privacy Policy heading', async () => {
	const { getByRole } = render(Privacy);
	await expect.element(getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
});

test('renders key sections', async () => {
	const { getByRole } = render(Privacy);
	await expect.element(getByRole('heading', { name: 'Information We Collect' })).toBeVisible();
	await expect.element(getByRole('heading', { name: 'Data Sharing' })).toBeVisible();
	await expect.element(getByRole('heading', { name: 'Security' })).toBeVisible();
});

test('links to terms of service', async () => {
	const { getByRole } = render(Privacy);
	await expect.element(getByRole('link', { name: 'Terms of Service' })).toBeVisible();
});
