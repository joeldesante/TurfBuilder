import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import { createRawSnippet } from 'svelte';
import DocumentLayout from './DocumentLayout.svelte';

const emptyChildren = createRawSnippet(() => ({ render: () => `<span></span>` }));

test('renders title', async () => {
	const screen = render(DocumentLayout, { title: 'Terms of Service', children: emptyChildren });
	await expect.element(screen.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
});

test('renders last updated date when provided', async () => {
	const screen = render(DocumentLayout, {
		title: 'Privacy Policy',
		lastUpdated: 'January 1, 2025',
		children: emptyChildren
	});
	await expect.element(screen.getByText('Last updated: January 1, 2025')).toBeVisible();
});

test('does not render last updated when omitted', async () => {
	const screen = render(DocumentLayout, { title: 'Privacy Policy', children: emptyChildren });
	const el = screen.container.querySelector('p');
	expect(el?.textContent).not.toContain('Last updated');
});

test('renders navigation links to terms and privacy', async () => {
	const screen = render(DocumentLayout, { title: 'Test', children: emptyChildren });
	const links = screen.container.querySelectorAll('a[href="/terms"], a[href="/privacy"]');
	expect(links.length).toBeGreaterThan(0);
});
