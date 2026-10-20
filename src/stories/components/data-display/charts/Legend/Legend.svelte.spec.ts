import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import { expect, test, vi } from 'vitest';
import Legend from './Legend.svelte';

const items = [
	{ key: 'a', label: 'Daily active', color: 'var(--chart-1)' },
	{ key: 'b', label: 'Weekly active', color: 'var(--chart-2)', value: '410' }
];

test('lists each series with its value', async () => {
	render(Legend, { props: { items } });

	await expect.element(page.getByText('Daily active')).toBeVisible();
	await expect.element(page.getByText('410')).toBeVisible();
	await expect.element(page.getByRole('button')).not.toBeInTheDocument();
});

test('toggles series when given ontoggle', async () => {
	const ontoggle = vi.fn();
	render(Legend, { props: { items, hidden: ['b'], ontoggle } });

	await expect.element(page.getByRole('button', { name: /Weekly active/ })).toHaveAttribute('aria-pressed', 'false');
	await page.getByRole('button', { name: /Daily active/ }).click();
	expect(ontoggle).toHaveBeenCalledWith('a');
});
