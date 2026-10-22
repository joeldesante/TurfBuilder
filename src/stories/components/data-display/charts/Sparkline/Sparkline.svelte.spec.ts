import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import { expect, test } from 'vitest';
import Sparkline from './Sparkline.svelte';

const points = [
	{ date: '2026-10-01', value: 4 },
	{ date: '2026-10-02', value: 9 },
	{ date: '2026-10-03', value: 6 }
];

test('describes the trend for screen readers', async () => {
	render(Sparkline, { props: { points, label: 'Sign-ups' } });

	await expect.element(page.getByRole('img', { name: 'Sign-ups: from 4 to 6, peaking at 9.' })).toBeVisible();
});

test('draws nothing but still describes a single point', async () => {
	const { container } = render(Sparkline, { props: { points: points.slice(0, 1), label: 'Sign-ups' } });

	expect(container.querySelector('svg')).toBeNull();
	await expect.element(page.getByText('Sign-ups: from 4 to 4, peaking at 4.')).toBeInTheDocument();
});
