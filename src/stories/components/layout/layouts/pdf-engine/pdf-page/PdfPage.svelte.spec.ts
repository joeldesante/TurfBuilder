import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import { createRawSnippet } from 'svelte';
import PdfPage from './PdfPage.svelte';

const emptyChildren = createRawSnippet(() => ({ render: () => `<span></span>` }));

test('renders children', async () => {
	const children = createRawSnippet(() => ({ render: () => `<p>Test content</p>` }));
	const screen = render(PdfPage, { type: 'Letter', children });
	await expect.element(screen.getByText('Test content')).toBeVisible();
});

test('renders pdf-page wrapper', async () => {
	const screen = render(PdfPage, { type: 'Letter', children: emptyChildren });
	const el = screen.container.querySelector('.pdf-page');
	expect(el).not.toBeNull();
});
