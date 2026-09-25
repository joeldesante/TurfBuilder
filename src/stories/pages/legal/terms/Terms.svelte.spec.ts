import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import Terms from './Terms.svelte';

test('renders Terms of Service heading', async () => {
	const { getByRole } = render(Terms);
	await expect.element(getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
});

// The page body is a placeholder until the terms text is written.
test('shows the placeholder text and when it was last updated', async () => {
	const { getByText } = render(Terms);
	await expect.element(getByText('Coming soon')).toBeVisible();
	await expect.element(getByText('June 18, 2026')).toBeVisible();
});

// The layout links to it from both the header and the footer.
test('links to the privacy policy from the header and footer', async () => {
	const { getByRole } = render(Terms);
	const links = getByRole('link', { name: 'Privacy Policy' });
	await expect.element(links.first()).toBeVisible();
	expect(links.elements()).toHaveLength(2);
	for (const link of links.elements()) expect(link.getAttribute('href')).toBe('/privacy');
});
