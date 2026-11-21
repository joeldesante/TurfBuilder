import { render } from 'vitest-browser-svelte';
import { createRawSnippet, type Snippet } from 'svelte';
import { expect, test } from 'vitest';
import SnippetHost from './SnippetHost.svelte';

test('renders the snippet with its argument', async () => {
	const snippet = createRawSnippet((name: () => string) => ({
		render: () => `<p>Hello, ${name()}</p>`
	}));

	const { getByText } = render(SnippetHost, { props: { snippet: snippet as Snippet<[unknown]>, arg: 'Ward 5' } });

	await expect.element(getByText('Hello, Ward 5')).toBeVisible();
});
