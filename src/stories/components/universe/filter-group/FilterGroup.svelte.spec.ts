import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import FilterGroup from './FilterGroup.svelte';
import type { Filter, FilterGroup as FilterGroupValue } from '$lib/shared/types/filters';

const city: Filter = { item: 'city', operation: 'equals', value: 'Austin' };

function setup(group: FilterGroupValue, onremove?: () => void) {
	const onchange = vi.fn();
	const screen = render(FilterGroup, { props: { group, onchange, onremove } });
	return { screen, onchange };
}

test('shows an empty message for a group with no filters', async () => {
	const { screen } = setup({ operator: 'AND', filters: [] });

	await expect.element(screen.getByText('No filters added yet.')).toBeVisible();
});

test('cannot remove a group unless onremove is given (the root)', async () => {
	const { screen } = setup({ operator: 'AND', filters: [] });

	await expect.element(screen.getByRole('button', { name: 'Remove group' })).not.toBeInTheDocument();
});

test('removes a nested group', async () => {
	const onremove = vi.fn();
	const { screen } = setup({ operator: 'AND', filters: [] }, onremove);

	await screen.getByRole('button', { name: 'Remove group' }).click();

	expect(onremove).toHaveBeenCalledTimes(1);
});

test('reports a changed operator', async () => {
	const { screen, onchange } = setup({ operator: 'AND', filters: [city] });

	await screen.getByRole('button', { name: 'Group operator' }).click();
	await screen.getByRole('option', { name: 'At least one of the following' }).click();

	expect(onchange).toHaveBeenCalledWith({ operator: 'OR', filters: [city] });
});

test('adds the chosen filter to the group', async () => {
	const { screen, onchange } = setup({ operator: 'AND', filters: [] });

	await screen.getByRole('button', { name: 'Add Filter' }).click();
	await screen.getByRole('button', { name: 'City' }).click();

	expect(onchange).toHaveBeenCalledWith({
		operator: 'AND',
		filters: [{ item: 'city', operation: 'equals', value: '' }]
	});
});

test('adds an empty nested group from the catalog', async () => {
	const { screen, onchange } = setup({ operator: 'AND', filters: [city] });

	await screen.getByRole('button', { name: 'Add Filter' }).click();
	await screen.getByRole('button', { name: 'Filter Group' }).click();

	expect(onchange).toHaveBeenCalledWith({
		operator: 'AND',
		filters: [city, { operator: 'AND', filters: [] }]
	});
});

test('renders nested groups and their filters', async () => {
	const { screen } = setup({
		operator: 'AND',
		filters: [city, { operator: 'OR', filters: [{ item: 'age', operation: 'greater_than', value: 65 }] }]
	});

	await expect.element(screen.getByRole('button', { name: 'Group operator' }).nth(1)).toBeVisible();
	await expect.element(screen.getByText('Age')).toBeVisible();
});

test('reports a change made inside a nested group to the parent', async () => {
	const inner: FilterGroupValue = { operator: 'OR', filters: [city] };
	const { screen, onchange } = setup({ operator: 'AND', filters: [inner] });

	await screen.getByRole('button', { name: 'Group operator' }).nth(1).click();
	await screen.getByRole('option', { name: 'All of the following' }).click();

	expect(onchange).toHaveBeenCalledWith({
		operator: 'AND',
		filters: [{ operator: 'AND', filters: [city] }]
	});
});

test('shows the group operator between filters, not before the first or after the last', async () => {
	const { screen } = setup({ operator: 'OR', filters: [city, city, city] });

	await expect.element(screen.getByText('OR', { exact: true }).nth(1)).toBeVisible();
	await expect.element(screen.getByText('OR', { exact: true }).nth(2)).not.toBeInTheDocument();
});

test('shows AND between filters in an AND group', async () => {
	const { screen } = setup({ operator: 'AND', filters: [city, city] });

	await expect.element(screen.getByText('AND', { exact: true })).toBeVisible();
});

test('reorders by dragging a grip onto another filter', async () => {
	const age: Filter = { item: 'age', operation: 'greater_than', value: 65 };
	const { screen, onchange } = setup({ operator: 'AND', filters: [city, age] });

	const grips = screen.getByRole('button', { name: 'Drag to reorder' });
	await userEvent.dragAndDrop(grips.first(), screen.getByText('Age'));

	expect(onchange).toHaveBeenCalledWith({ operator: 'AND', filters: [age, city] });
});
