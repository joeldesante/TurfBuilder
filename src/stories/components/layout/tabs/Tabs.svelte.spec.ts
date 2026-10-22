import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import Tabs from './Tabs.svelte';

const tabs = [
	{ id: 'overview', label: 'Overview', href: '?tab=overview' },
	{ id: 'members', label: 'Members', href: '?tab=members', count: 1284 }
];

test('renders each tab as a link in a named navigation', async () => {
	const { getByRole } = render(Tabs, { props: { tabs, active: 'overview', label: 'Sections' } });

	await expect.element(getByRole('navigation', { name: 'Sections' })).toBeVisible();
	await expect.element(getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '?tab=overview');
});

test('marks only the active tab as current', async () => {
	const { getByRole } = render(Tabs, { props: { tabs, active: 'members', label: 'Sections' } });

	await expect.element(getByRole('link', { name: /Members/ })).toHaveAttribute('aria-current', 'page');
	await expect.element(getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
});

test('shows a formatted count', async () => {
	const { getByText } = render(Tabs, { props: { tabs, active: 'overview', label: 'Sections' } });

	await expect.element(getByText('1,284')).toBeVisible();
});
