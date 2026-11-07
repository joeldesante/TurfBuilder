import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import Privacy from './Privacy.svelte';

test('renders Privacy Policy heading', async () => {
	const { getByRole } = render(Privacy);
	await expect.element(getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();
});

// The layout links to it from both the header and the footer.
test('links to the terms of service from the header and footer', async () => {
	const { getByRole } = render(Privacy);
	const links = getByRole('link', { name: 'Terms of Service' });
	await expect.element(links.first()).toBeVisible();
	expect(links.elements()).toHaveLength(2);
	for (const link of links.elements()) expect(link.getAttribute('href')).toBe('/terms');
});
