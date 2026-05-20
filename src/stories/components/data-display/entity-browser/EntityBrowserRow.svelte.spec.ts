import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import EntityBrowserRow from './EntityBrowserRow.svelte';

test('renders entity name', async () => {
	const { getByText } = render(EntityBrowserRow, {
		props: { name: 'Door Knock Script', date: new Date().toISOString(), href: '/editor/1' }
	});
	await expect.element(getByText('Door Knock Script')).toBeVisible();
});

test('renders as a link to href', async () => {
	const { getByRole } = render(EntityBrowserRow, {
		props: { name: 'Door Knock Script', date: new Date().toISOString(), href: '/editor/1' }
	});
	await expect.element(getByRole('link', { name: /Door Knock Script/ })).toHaveAttribute('href', '/editor/1');
});

test('renders a formatted date', async () => {
	const { getByText } = render(EntityBrowserRow, {
		props: { name: 'Script', date: new Date('2026-01-05T00:00:00').toISOString(), href: '#' }
	});
	await expect.element(getByText('Jan 5')).toBeVisible();
});
