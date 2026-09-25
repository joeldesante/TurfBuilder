import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import Privacy from './Privacy.svelte';

test('renders Privacy Policy heading', async () => {
	const { getByRole } = render(Privacy);
	await expect.element(getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
});

// The page body is a placeholder until the privacy text is written.
test('shows the placeholder text and when it was last updated', async () => {
	const { getByText } = render(Privacy);
	await expect.element(getByText('Coming soon')).toBeVisible();
	await expect.element(getByText('June 18, 2026')).toBeVisible();
});

// The layout links to it from both the header and the footer.
test('links to the terms of service from the header and footer', async () => {
	const { getByRole } = render(Privacy);
	const links = getByRole('link', { name: 'Terms of Service' });
	await expect.element(links.first()).toBeVisible();
	expect(links.elements()).toHaveLength(2);
	for (const link of links.elements()) expect(link.getAttribute('href')).toBe('/terms');
});
