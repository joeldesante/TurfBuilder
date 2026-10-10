import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import FilterRow from './FilterRow.svelte';
import { getFilter } from '$lib/shared/utils/filter-registry';
import type { Filter } from '$lib/shared/types/filters';

function setup(item: string, filter: Partial<Filter> = {}) {
	const onchange = vi.fn();
	const onremove = vi.fn();
	const full: Filter = {
		item,
		operation: getFilter(item)!.operations[0],
		value: '',
		...filter
	};
	const screen = render(FilterRow, {
		props: { definition: getFilter(item)!, filter: full, onchange, onremove }
	});
	return { screen, onchange, onremove, full };
}

test('shows the filter name', async () => {
	const { screen } = setup('city');

	await expect.element(screen.getByText('City')).toBeVisible();
});

test('offers only the operations the filter supports', async () => {
	const { screen } = setup('distance_from_address');

	await screen.getByRole('button', { name: 'Operation' }).click();

	await expect.element(screen.getByRole('option', { name: 'is less than' })).toBeInTheDocument();
	await expect.element(screen.getByRole('option', { name: 'contains' })).not.toBeInTheDocument();
});

test('reports a changed operation', async () => {
	const { screen, onchange, full } = setup('city');

	await screen.getByRole('button', { name: 'Operation' }).click();
	await screen.getByRole('option', { name: 'contains' }).click();

	expect(onchange).toHaveBeenCalledWith({ ...full, operation: 'contains' });
});

test('reports typed text', async () => {
	const { screen, onchange, full } = setup('city');

	await screen.getByRole('textbox', { name: 'Value' }).fill('Austin');

	expect(onchange).toHaveBeenLastCalledWith({ ...full, value: 'Austin' });
});

test('reports a number as a number and shows its unit', async () => {
	const { screen, onchange, full } = setup('distance_from_address');

	await expect.element(screen.getByText('miles')).toBeVisible();
	await screen.getByRole('spinbutton', { name: 'Value' }).fill('5');

	expect(onchange).toHaveBeenLastCalledWith({ ...full, value: 5 });
});

test('reports a chosen select option', async () => {
	const { screen, onchange, full } = setup('door_open_response');

	await screen.getByRole('button', { name: 'Value' }).click();
	await screen.getByRole('option', { name: 'Not home' }).click();

	expect(onchange).toHaveBeenLastCalledWith({ ...full, value: 'not_home' });
});

test('calls onremove', async () => {
	const { screen, onremove } = setup('city');

	await screen.getByRole('button', { name: 'Remove filter' }).click();

	expect(onremove).toHaveBeenCalledTimes(1);
});

test('shows a set radius filter as a View / Edit button that opens the map picker', async () => {
	const { screen } = setup('radius_from_point', {
		value: { latitude: 40.0259, longitude: -75.2238, radius: 2 }
	});

	await expect.element(screen.getByRole('button', { name: 'Value' })).toHaveTextContent('View / Edit area');
	await screen.getByRole('button', { name: 'Value' }).click();

	await expect.element(screen.getByRole('heading', { name: 'Radius From Point' })).toBeVisible();
});

test('labels the radius operations', async () => {
	const { screen } = setup('radius_from_point');

	await screen.getByRole('button', { name: 'Operation' }).click();

	await expect.element(screen.getByRole('option', { name: 'is within' })).toBeInTheDocument();
	await expect.element(screen.getByRole('option', { name: 'is not within' })).toBeInTheDocument();
});

test('shows a polygon filter as a button that opens the drawing modal', async () => {
	const { screen } = setup('inside_drawn_region');

	await expect.element(screen.getByRole('button', { name: 'Value' })).toHaveTextContent('Draw area');
	await screen.getByRole('button', { name: 'Value' }).click();

	await expect.element(screen.getByRole('heading', { name: 'Drawn Region' })).toBeVisible();
});

test('shows a grip only when it can be dragged', async () => {
	const withoutGrip = setup('city');
	await expect.element(withoutGrip.screen.getByRole('button', { name: 'Drag to reorder' })).not.toBeInTheDocument();
	withoutGrip.screen.unmount();

	const screen = render(FilterRow, {
		props: {
			definition: getFilter('city')!,
			filter: { item: 'city', operation: 'equals', value: '' },
			onchange: () => {},
			onremove: () => {},
			ondragstart: () => {}
		}
	});
	await expect.element(screen.getByRole('button', { name: 'Drag to reorder' })).toBeVisible();
});

test('text filters can be made case sensitive', async () => {
	const { screen, onchange, full } = setup('city');

	await screen.getByRole('checkbox', { name: 'Case sensitive' }).click();

	expect(onchange).toHaveBeenCalledWith({ ...full, caseSensitive: true });
});

test('shows the saved case sensitivity', async () => {
	const { screen } = setup('city', { caseSensitive: true });

	await expect.element(screen.getByRole('checkbox', { name: 'Case sensitive' })).toBeChecked();
});

test('only text filters offer case sensitivity', async () => {
	const { screen } = setup('age');

	await expect.element(screen.getByRole('checkbox', { name: 'Case sensitive' })).not.toBeInTheDocument();
});
