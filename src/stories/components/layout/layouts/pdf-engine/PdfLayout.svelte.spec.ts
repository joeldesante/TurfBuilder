import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import { createRawSnippet } from 'svelte';
import PdfLayout from './PdfLayout.svelte';

const emptyChildren = createRawSnippet(() => ({ render: () => `<span></span>` }));

test('renders children', async () => {
	const children = createRawSnippet(() => ({ render: () => `<p>Test content</p>` }));
	const screen = render(PdfLayout, { children });
	await expect.element(screen.getByText('Test content')).toBeVisible();
});

test('renders pdf-layout wrapper', async () => {
	const screen = render(PdfLayout, { children: emptyChildren });
	const el = screen.container.querySelector('.pdf-layout');
	expect(el).not.toBeNull();
});
