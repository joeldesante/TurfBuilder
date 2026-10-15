import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import FilterEditModal from './FilterEditModal.svelte';
import { getFilter } from '$lib/shared/utils/filter-registry';
import type { Filter } from '$lib/shared/types/filters';

function setup(item: string, filter: Partial<Filter> = {}, extra: Record<string, unknown> = {}) {
	const onsave = vi.fn();
	const oncancel = vi.fn();
	const full: Filter = {
		item,
		operation: getFilter(item)!.operations[0],
		value: '',
		...filter
	};
	const screen = render(FilterEditModal, {
		props: { open: true, definition: getFilter(item)!, filter: full, onsave, oncancel, ...extra }
	});
	return { screen, onsave, oncancel, full };
}

test('shows the filter name and description', async () => {
	const { screen } = setup('city');

	await expect.element(screen.getByRole('heading', { name: 'City' })).toBeVisible();
	await expect.element(screen.getByText('The city of the location.')).toBeVisible();
});

test('renders nothing while closed', async () => {
	const screen = render(FilterEditModal, {
		props: {
			open: false,
			definition: getFilter('city')!,
			filter: { item: 'city', operation: 'equals', value: '' },
			onsave: () => {},
			oncancel: () => {}
		}
	});

	await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
});

test('previews the sentence as it is edited', async () => {
	const { screen } = setup('city');

	await screen.getByRole('textbox', { name: 'Value' }).fill('Austin');

	await expect.element(screen.getByLabelText('Preview')).toHaveTextContent('whose city is Austin');
});

test('only offers the operations the filter supports', async () => {
	const { screen } = setup('city');

	await screen.getByRole('button', { name: 'Operation' }).click();

	await expect.element(screen.getByRole('option', { name: 'contains' })).toBeInTheDocument();
	await expect.element(screen.getByRole('option', { name: 'is greater than' })).not.toBeInTheDocument();
});

test('saves the edited operation', async () => {
	const { screen, onsave, full } = setup('city', { value: 'Austin' });

	await screen.getByRole('button', { name: 'Operation' }).click();
	await screen.getByRole('option', { name: 'contains' }).click();
	await screen.getByRole('button', { name: 'Save' }).click();

	expect(onsave).toHaveBeenCalledWith({ ...full, operation: 'contains' });
});

test('text filters can be made case sensitive', async () => {
	const { screen, onsave, full } = setup('city', { value: 'Austin' });

	await screen.getByRole('checkbox', { name: 'Case sensitive' }).click();
	await screen.getByRole('button', { name: 'Save' }).click();

	expect(onsave).toHaveBeenCalledWith({ ...full, caseSensitive: true });
});

test('only text filters offer case sensitivity', async () => {
	const { screen } = setup('age', { value: 30 });

	await expect.element(screen.getByRole('checkbox', { name: 'Case sensitive' })).not.toBeInTheDocument();
});

test('reports a number as a number and shows its unit', async () => {
	const { screen, onsave, full } = setup('age', { operation: 'greater_than' });

	await expect.element(screen.getByText('Number of years')).toBeVisible();
	await screen.getByRole('spinbutton', { name: 'Value' }).fill('65');
	await screen.getByRole('button', { name: 'Save' }).click();

	expect(onsave).toHaveBeenCalledWith({ ...full, value: 65 });
});

test('offers a yes or no choice in the filter\'s own words', async () => {
	const { screen, onsave, full } = setup('has_email', { operation: 'equals', value: true });

	await screen.getByRole('button', { name: 'Value' }).click();
	await expect.element(screen.getByRole('option', { name: 'have', exact: true })).toBeInTheDocument();
	await screen.getByRole('option', { name: 'do not have' }).click();
	await screen.getByRole('button', { name: 'Save' }).click();

	expect(onsave).toHaveBeenCalledWith({ ...full, value: false });
});

test('Save stays disabled until the filter is complete', async () => {
	const { screen } = setup('city');

	await expect.element(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
	await screen.getByRole('textbox', { name: 'Value' }).fill('Austin');
	await expect.element(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('says Add filter for a new filter', async () => {
	const { screen } = setup('city', {}, { isNew: true });

	await expect.element(screen.getByRole('button', { name: 'Add filter', exact: true })).toBeVisible();
	await expect.element(screen.getByRole('button', { name: 'Save' })).not.toBeInTheDocument();
});

test('Cancel and Close both report a cancel without saving', async () => {
	const first = setup('city', { value: 'Austin' });
	await first.screen.getByRole('button', { name: 'Cancel' }).click();
	expect(first.oncancel).toHaveBeenCalledTimes(1);
	first.screen.unmount();

	const second = setup('city', { value: 'Austin' });
	await second.screen.getByRole('button', { name: 'Close' }).click();
	expect(second.oncancel).toHaveBeenCalledTimes(1);
	expect(second.onsave).not.toHaveBeenCalled();
});

test('asks for an area on a radius filter and shows the picker', async () => {
	const { screen } = setup('radius_from_point', { operation: 'within' });

	await expect.element(screen.getByRole('button', { name: 'Value' })).toHaveTextContent('Choose area');
	await screen.getByRole('button', { name: 'Value' }).click();

	await expect.element(screen.getByText(/Click the map to choose a point/)).toBeVisible();
});

test('survey choices are unavailable without a source', async () => {
	const { screen } = setup('survey_question_response');

	await expect.element(screen.getByText('Survey choices are unavailable here.')).toBeVisible();
});

test('its text cannot be selected, but what is typed into a field can', async () => {
	const { screen } = setup('city', { value: 'Austin' });

	// Tailwind's styles are not loaded in component tests, so this checks the classes that set them.
	const dialog = screen.getByRole('dialog').element();
	expect(dialog.classList).toContain('select-none');
	expect(dialog.classList).toContain('[&_input]:select-text');
	expect(dialog.classList).toContain('[&_textarea]:select-text');
});

test('stays unselectable while the mouse is held down in it', async () => {
	const { screen } = setup('city', { value: 'Austin' });
	const dialog = screen.getByRole('dialog').element() as HTMLElement;

	// bits-ui would make the dialog selectable for the length of a press; it is turned off here.
	screen.getByRole('heading', { name: 'City' }).element().dispatchEvent(
		new PointerEvent('pointerdown', { bubbles: true })
	);

	expect(dialog.style.userSelect).not.toBe('text');
	document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
});
