import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import FilterCatalog from './FilterCatalog.svelte';
import type { FilterRegistryEntry } from '$lib/shared/types/filter-registry';
import { getFilters } from '$lib/shared/utils/filter-registry';

const entry = (id: string, name: string, category: FilterRegistryEntry['category']) =>
	({
		id,
		name,
		description: `${name} description`,
		category,
		entities: ['locations'],
		valueType: 'text',
		operations: ['equals']
	}) as FilterRegistryEntry;

const filters = [
	entry('last', 'Last Time Canvassed', 'meta'),
	entry('distance', 'Distance From Address', 'geographical'),
	entry('door', 'Door Open', 'survey')
];

const base = { open: true, filters, onOpenChange: () => {} };

test('renders nothing while closed', async () => {
	const { getByText } = render(FilterCatalog, { props: { ...base, open: false } });

	await expect.element(getByText('Add a Filter')).not.toBeInTheDocument();
});

test('shows every filter under Everything by default', async () => {
	const { getByRole } = render(FilterCatalog, { props: base });

	await expect.element(getByRole('button', { name: 'Distance From Address' })).toBeVisible();
	await expect.element(getByRole('button', { name: 'Door Open' })).toBeVisible();
	await expect.element(getByRole('button', { name: 'Last Time Canvassed' })).toBeVisible();
});

test('narrows the list when a category is chosen', async () => {
	const { getByRole } = render(FilterCatalog, { props: base });

	await getByRole('button', { name: 'Survey' }).click();

	await expect.element(getByRole('button', { name: 'Door Open' })).toBeVisible();
	await expect.element(getByRole('button', { name: 'Distance From Address' })).not.toBeInTheDocument();
});

test('shows an empty message for a category with no filters', async () => {
	const { getByRole, getByText } = render(FilterCatalog, {
		props: { ...base, filters: filters.filter((f) => f.id === 'distance') }
	});

	await getByRole('button', { name: 'Meta' }).click();

	await expect.element(getByText('No filters in this category yet.')).toBeVisible();
});

test('calls onselect with the chosen filter', async () => {
	const onselect = vi.fn();
	const { getByRole } = render(FilterCatalog, { props: { ...base, onselect } });

	await getByRole('button', { name: 'Door Open' }).click();

	expect(onselect).toHaveBeenCalledWith(filters.find((f) => f.id === 'door'));
});

test('calls onOpenChange with false when the close button is pressed', async () => {
	const onOpenChange = vi.fn();
	const { getByRole } = render(FilterCatalog, { props: { ...base, onOpenChange } });

	await getByRole('button', { name: 'Close' }).click();

	expect(onOpenChange).toHaveBeenCalledWith(false);
});

test('lists the shared registry when no filters are passed', async () => {
	const first = getFilters()[0];
	const { getByRole } = render(FilterCatalog, { props: { open: true, onOpenChange: () => {} } });

	await expect.element(getByRole('button', { name: first.name })).toBeVisible();
});

test('groups Everything by category in order, regardless of input order', async () => {
	const { getByRole } = render(FilterCatalog, { props: base });

	const headings = await getByRole('heading', { level: 3 }).all();
	expect(headings.map((h) => h.element().textContent)).toEqual(['Geographical', 'Survey', 'Meta']);
});

test('drops the group headings when a single category is chosen', async () => {
	const { getByRole } = render(FilterCatalog, { props: base });

	await getByRole('button', { name: 'Survey' }).click();

	await expect.element(getByRole('heading', { level: 3 })).not.toBeInTheDocument();
});

test('offers no group option unless onselectgroup is given', async () => {
	const { getByRole } = render(FilterCatalog, { props: base });

	await expect.element(getByRole('button', { name: 'Filter Group' })).not.toBeInTheDocument();
	await expect.element(getByRole('button', { name: 'Groups', exact: true })).not.toBeInTheDocument();
});

test('calls onselectgroup when the Filter Group option is chosen', async () => {
	const onselectgroup = vi.fn();
	const { getByRole } = render(FilterCatalog, { props: { ...base, onselectgroup } });

	await getByRole('button', { name: 'Filter Group' }).click();

	expect(onselectgroup).toHaveBeenCalledTimes(1);
});

test('the Groups category shows only the group option', async () => {
	const { getByRole } = render(FilterCatalog, { props: { ...base, onselectgroup: () => {} } });

	await getByRole('button', { name: 'Groups', exact: true }).click();

	await expect.element(getByRole('button', { name: 'Filter Group' })).toBeVisible();
	await expect.element(getByRole('button', { name: 'Door Open' })).not.toBeInTheDocument();
});

test('its text cannot be selected, even while the mouse is held down in it', async () => {
	const { getByRole } = render(FilterCatalog, { props: base });
	const dialog = getByRole('dialog').element() as HTMLElement;

	getByRole('heading', { name: 'Add a Filter' }).element().dispatchEvent(
		new PointerEvent('pointerdown', { bubbles: true })
	);

	// Tailwind's styles are not loaded in component tests, so this checks the class and the inline style.
	expect(dialog.classList).toContain('select-none');
	expect(dialog.style.userSelect).not.toBe('text');
	document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
});
