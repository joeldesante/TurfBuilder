import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import { page } from '@vitest/browser/context';
// The real stylesheet, so the buttons have the sizes they have in the app.
import '/src/app.css';
import PageJumper from './PageJumper.svelte';

const startOf = (n: number) => n * 100;
const props = { pageCount: 40, current: 20, onSelect: () => {}, startOf };

const box = (el: Element) => {
	const rect = el.getBoundingClientRect();
	return { width: Math.round(rect.width), height: Math.round(rect.height) };
};
/** The window the page buttons slide in, which is as wide as the buttons that show. */
const clip = (container: Element) => container.querySelector<HTMLElement>('nav .overflow-hidden')!;

test('is the normal size unless asked for the large one', async () => {
	const { container } = render(PageJumper, { props });
	await expect.element(page.getByRole('button', { name: 'Jump to 2,000' })).toBeVisible();

	expect(box(clip(container))).toEqual({ width: 5 * 40, height: 40 });
	expect(box(page.getByRole('button', { name: 'Next section' }).element())).toEqual({
		width: 32,
		height: 32
	});
});

test('the large size makes every button at least 44px, the smallest comfortable target for a finger', async () => {
	const { container } = render(PageJumper, { props: { ...props, size: 'large' } });
	await expect.element(page.getByRole('button', { name: 'Jump to 2,000' })).toBeVisible();

	expect(box(clip(container))).toEqual({ width: 5 * 44, height: 44 });
	for (const name of ['Previous section', 'Next section']) {
		const size = box(page.getByRole('button', { name }).element());
		expect(size.width).toBeGreaterThanOrEqual(44);
		expect(size.height).toBeGreaterThanOrEqual(44);
	}
	const current = box(page.getByRole('button', { name: 'Jump to 2,000' }).element());
	expect(current.width).toBeGreaterThanOrEqual(44);
	expect(current.height).toBeGreaterThanOrEqual(44);
});

test('the large size reads bigger', async () => {
	render(PageJumper, { props: { ...props, size: 'large' } });
	const large = getComputedStyle(page.getByRole('button', { name: 'Jump to 2,000' }).element());
	expect(parseFloat(large.fontSize)).toBeGreaterThanOrEqual(14);
});

test('the buttons turn off double-tap zoom, so a tap is a tap', async () => {
	render(PageJumper, { props });
	for (const name of ['Jump to 2,000', 'Next section']) {
		expect(getComputedStyle(page.getByRole('button', { name }).element()).touchAction).toBe(
			'manipulation'
		);
	}
});

test('shows fewer buttons when asked, in either size', async () => {
	const { container } = render(PageJumper, { props: { ...props, visible: 3, size: 'large' } });
	await expect.element(page.getByRole('button', { name: 'Jump to 2,000' })).toBeVisible();

	expect(box(clip(container))).toEqual({ width: 3 * 44, height: 44 });
});

test('still keeps the current page in the middle in the large size', async () => {
	render(PageJumper, { props: { ...props, visible: 3, size: 'large' } });

	const current = page
		.getByRole('button', { name: 'Jump to 2,000' })
		.element()
		.getBoundingClientRect();
	const previous = page
		.getByRole('button', { name: 'Jump to 1,900' })
		.element()
		.getBoundingClientRect();
	const next = page
		.getByRole('button', { name: 'Jump to 2,100' })
		.element()
		.getBoundingClientRect();
	await expect
		.element(page.getByRole('button', { name: 'Jump to 2,000' }))
		.toHaveAttribute('aria-current', 'true');
	expect(Math.round(current.left - previous.left)).toBe(44);
	expect(Math.round(next.left - current.left)).toBe(44);
});
