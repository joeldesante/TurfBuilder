import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import PageJumper from './PageJumper.svelte';

// Pages jump to 0, 100, 200 ...
const startOf = (page: number) => page * 100;

test('shows nothing for a single page', async () => {
	const { getByRole } = render(PageJumper, {
		props: { pageCount: 1, current: 0, onSelect: () => {}, startOf }
	});
	await expect.element(getByRole('navigation')).not.toBeInTheDocument();
});

test('shows every page when there are five or fewer', async () => {
	const { getByRole } = render(PageJumper, {
		props: { pageCount: 4, current: 0, onSelect: () => {}, startOf }
	});
	await expect.element(getByRole('button', { name: 'Jump to Top' })).toBeVisible();
	await expect.element(getByRole('button', { name: 'Jump to 300' })).toBeVisible();
});

test('marks only the current page', async () => {
	const { getByRole } = render(PageJumper, {
		props: { pageCount: 4, current: 2, onSelect: () => {}, startOf }
	});
	await expect
		.element(getByRole('button', { name: 'Jump to 200' }))
		.toHaveAttribute('aria-current', 'true');
	await expect
		.element(getByRole('button', { name: 'Jump to Top' }))
		.not.toHaveAttribute('aria-current');
});

test('calls onSelect with the page, counting from 0', async () => {
	const onSelect = vi.fn();
	const { getByRole } = render(PageJumper, {
		props: { pageCount: 4, current: 0, onSelect, startOf }
	});
	await getByRole('button', { name: 'Jump to 200' }).click();
	expect(onSelect).toHaveBeenCalledWith(2);
});

test('centers the current page when there are more than five', async () => {
	const { getByRole } = render(PageJumper, {
		props: { pageCount: 40, current: 20, onSelect: () => {}, startOf }
	});
	await expect
		.element(getByRole('button', { name: 'Jump to 2,000' }))
		.toHaveAttribute('aria-current', 'true');
	// Pages 19 to 23 are in view; the neighbors beside them are drawn but clipped.
	await expect.element(getByRole('button', { name: 'Jump to 400' })).not.toBeInTheDocument();
});

test('the chevrons select the neighbors and stop at the ends', async () => {
	const onSelect = vi.fn();
	const { getByRole } = render(PageJumper, {
		props: { pageCount: 4, current: 0, onSelect, startOf }
	});
	await expect.element(getByRole('button', { name: 'Previous section' })).toBeDisabled();
	await getByRole('button', { name: 'Next section' }).click();
	expect(onSelect).toHaveBeenCalledWith(1);
});

test('hovering a page says where it jumps to', async () => {
	const { getByRole } = render(PageJumper, {
		props: { pageCount: 4, current: 0, onSelect: () => {}, startOf }
	});
	await getByRole('button', { name: 'Jump to 200' }).hover();
	await expect.element(page.getByText('Jump to 200', { exact: true }).first()).toBeVisible();
});

test('calls the first page Jump to Top, however it is numbered, and the others by where they jump to', async () => {
	const { getByRole } = render(PageJumper, {
		props: { pageCount: 4, current: 1, onSelect: () => {}, startOf: (n: number) => n * 100 + 7 }
	});

	await expect.element(getByRole('button', { name: 'Jump to Top' })).toBeVisible();
	await expect.element(getByRole('button', { name: 'Jump to 107' })).toBeVisible();
	await expect.element(getByRole('button', { name: 'Jump to 7' })).not.toBeInTheDocument();
});

test('says Jump to Top in the tooltip of the first page', async () => {
	const { getByRole } = render(PageJumper, {
		props: { pageCount: 4, current: 2, onSelect: () => {}, startOf }
	});

	await getByRole('button', { name: 'Jump to Top' }).hover();

	await expect.element(page.getByText('Jump to Top', { exact: true }).last()).toBeVisible();
});

test('selecting the first page still reports page 0', async () => {
	let chosen = -1;
	const { getByRole } = render(PageJumper, {
		props: { pageCount: 4, current: 2, onSelect: (n: number) => (chosen = n), startOf }
	});

	await getByRole('button', { name: 'Jump to Top' }).click();

	expect(chosen).toBe(0);
});
