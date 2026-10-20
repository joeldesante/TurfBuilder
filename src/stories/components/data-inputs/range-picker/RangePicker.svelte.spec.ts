import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import { expect, test, vi } from 'vitest';
import RangePicker from './RangePicker.svelte';

test('marks the current range and granularity', async () => {
	render(RangePicker, { props: { range: '30d', granularity: 'day', onchange: vi.fn() } });

	await expect.element(page.getByRole('radio', { name: '30 days' })).toHaveAttribute('aria-checked', 'true');
	await expect.element(page.getByRole('radio', { name: 'Day', exact: true })).toHaveAttribute('aria-checked', 'true');
});

test('a new range brings its usual granularity', async () => {
	const onchange = vi.fn();
	render(RangePicker, { props: { range: '30d', granularity: 'day', onchange } });

	await page.getByRole('radio', { name: '1 year' }).click();
	expect(onchange).toHaveBeenCalledWith({ range: '1y', granularity: 'month' });
});

test('changing the granularity keeps the range', async () => {
	const onchange = vi.fn();
	render(RangePicker, { props: { range: '90d', granularity: 'week', onchange } });

	await page.getByRole('radio', { name: 'Day', exact: true }).click();
	expect(onchange).toHaveBeenCalledWith({ range: '90d', granularity: 'day' });
});

test('can hide the granularity', async () => {
	render(RangePicker, { props: { range: '90d', granularity: 'week', onchange: vi.fn(), showGranularity: false } });

	await expect.element(page.getByRole('group', { name: 'Group by' })).not.toBeInTheDocument();
});
