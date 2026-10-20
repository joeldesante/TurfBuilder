import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import { describe, expect, test } from 'vitest';
import StatTile from './StatTile.svelte';

describe('StatTile', () => {
	test('shows the label and formatted value', async () => {
		render(StatTile, { props: { label: 'Accounts', value: 12345 } });

		await expect.element(page.getByText('Accounts')).toBeVisible();
		await expect.element(page.getByText('12,345')).toBeVisible();
	});

	test('reads the change in words and colors it by which way is good', async () => {
		const { container } = render(StatTile, {
			props: { label: 'Failed emails', value: 7, change: 0.4, goodDirection: 'down' }
		});

		await expect.element(page.getByText('+40%')).toBeVisible();
		await expect.element(page.getByText('up 40%')).toBeInTheDocument();
		expect(container.innerHTML).toContain('var(--chart-delta-bad)');
	});

	test('calls a change from nothing new', async () => {
		render(StatTile, { props: { label: 'Visits', value: 3, change: null } });

		await expect.element(page.getByText('New', { exact: true })).toBeVisible();
	});

	test('can be a link', async () => {
		render(StatTile, { props: { label: 'Organizations', value: 48, href: '/infra/orgs' } });

		await expect.element(page.getByRole('link', { name: /Organizations/ })).toHaveAttribute('href', '/infra/orgs');
	});
});
