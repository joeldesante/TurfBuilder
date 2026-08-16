import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import { createRawSnippet } from 'svelte';
import PdfLayout from './PdfLayout.svelte';

const emptyPage = createRawSnippet(() => ({ render: () => `<span></span>` }));

test('renders pages', async () => {
	const page = createRawSnippet(() => ({ render: () => `<p>Test content</p>` }));
	const screen = render(PdfLayout, { pages: [page] });
	await expect.element(screen.getByText('Test content')).toBeVisible();
});

test('renders pdf-layout wrapper', async () => {
	const screen = render(PdfLayout, { pages: [emptyPage] });
	const el = screen.container.querySelector('.pdf-layout-root');
	expect(el).not.toBeNull();
});
