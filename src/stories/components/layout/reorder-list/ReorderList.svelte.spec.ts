import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import ReorderListHarness from '../../__tests__/ReorderListHarness.svelte';
import { dragBy } from '../../__tests__/drag';

const texts = async () =>
	(await page.getByRole('listitem').all()).map((i) => i.element().textContent?.trim());

describe('ReorderList', () => {
	it('renders every item in the given order', async () => {
		render(ReorderListHarness, { ids: ['a', 'b', 'c'] });

		expect(await texts()).toEqual(['Item a', 'Item b', 'Item c']);
	});

	it('shows a new saved order when ids change', async () => {
		const screen = render(ReorderListHarness, { ids: ['a', 'b'] });

		await screen.rerender({ ids: ['b', 'a'] });

		expect(await texts()).toEqual(['Item b', 'Item a']);
	});

	it('is not draggable without onReorder', async () => {
		render(ReorderListHarness, { ids: ['a', 'b'], withReorder: false });

		const first = page.getByRole('listitem').first().element() as HTMLElement;
		const before = first.getBoundingClientRect().left;
		const release = await dragBy(first, 200);

		expect(first.getBoundingClientRect().left).toBe(before);
		release();
	});

	it('reports the new order once when an item is dragged past its neighbour', async () => {
		const onReorder = vi.fn().mockResolvedValue(undefined);
		render(ReorderListHarness, { ids: ['a', 'b', 'c'], onReorder });

		const first = page.getByRole('listitem').first().element() as HTMLElement;
		const release = await dragBy(first, 60);
		release();

		await vi.waitFor(() => expect(onReorder).toHaveBeenCalledTimes(1));
		expect(onReorder.mock.calls[0][0]).not.toEqual(['a', 'b', 'c']);
	});

	it('does not let an item be dragged past the start of the list', async () => {
		render(ReorderListHarness, { ids: ['a', 'b', 'c'], onReorder: vi.fn() });

		const list = document.body.querySelector('ul')!;
		const first = page.getByRole('listitem').first().element() as HTMLElement;
		const release = await dragBy(first, -600);

		expect(first.getBoundingClientRect().left).toBeGreaterThanOrEqual(
			list.getBoundingClientRect().left - 1
		);
		release();
	});

	it('does not let an item be dragged past the end of the list', async () => {
		render(ReorderListHarness, { ids: ['a', 'b', 'c'], onReorder: vi.fn() });

		const list = document.body.querySelector('ul')!;
		const last = page.getByRole('listitem').last().element() as HTMLElement;
		const release = await dragBy(last, 600);

		expect(last.getBoundingClientRect().right).toBeLessThanOrEqual(
			list.getBoundingClientRect().right + 1
		);
		release();
	});
});
