import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import FilterRow from './FilterRow.svelte';
import {
	FILTER_SOURCE_KEY
} from '$components/universe/filter-group/filter-source.svelte';
import { defaultContactMade, getFilter } from '$lib/shared/utils/filter-registry';
import type { FilterSource } from '$lib/client/filter-source';
import type { Filter } from '$lib/shared/types/filters';

const BUCKET = '11111111-1111-4111-8111-111111111111';

function setup(item: string, filter: Partial<Filter> = {}, extra: Record<string, unknown> = {}) {
	const onchange = vi.fn();
	const onremove = vi.fn();
	const full: Filter = {
		item,
		operation: getFilter(item)!.operations[0],
		value: '',
		...filter
	};
	const screen = render(FilterRow, {
		props: { definition: getFilter(item)!, filter: full, onchange, onremove, ...extra }
	});
	return { screen, onchange, onremove, full };
}

const city = { value: 'Austin' };

test('describes the filter as a sentence', async () => {
	const { screen } = setup('city', city);

	await expect.element(screen.getByText(/Select only Records whose city is Austin/)).toBeVisible();
});

test('names the filter above the sentence, or beside the grip on a phone', async () => {
	const { screen } = setup('zip_code', { value: '191' });

	const [header, bar] = screen.getByText('ZIP Code', { exact: true }).elements();
	expect(header).toHaveClass('text-xs', 'font-semibold', 'max-sm:hidden');
	expect(bar).toHaveClass('text-sm', 'font-semibold', 'sm:hidden');
});

test('opens the editor from a setting in the sentence', async () => {
	const { screen } = setup('city', city);

	await screen.getByRole('button', { name: 'Austin' }).click();

	await expect.element(screen.getByRole('textbox', { name: 'Value' })).toHaveValue('Austin');
});

test('shows no editing controls until Edit is pressed', async () => {
	const { screen } = setup('city', city);

	await expect.element(screen.getByRole('textbox', { name: 'Value' })).not.toBeInTheDocument();
	await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
});

test('Edit opens the filter in a dialog', async () => {
	const { screen } = setup('city', city);

	await screen.getByRole('button', { name: 'Edit filter' }).click();

	await expect.element(screen.getByRole('dialog')).toBeVisible();
	await expect.element(screen.getByRole('heading', { name: 'City' })).toBeVisible();
	await expect.element(screen.getByRole('textbox', { name: 'Value' })).toHaveValue('Austin');
});

test('changes nothing until Save, then reports the edited filter', async () => {
	const { screen, onchange, full } = setup('city', city);

	await screen.getByRole('button', { name: 'Edit filter' }).click();
	await screen.getByRole('textbox', { name: 'Value' }).fill('Dallas');
	expect(onchange).not.toHaveBeenCalled();
	await screen.getByRole('button', { name: 'Save' }).click();

	expect(onchange).toHaveBeenCalledWith({ ...full, value: 'Dallas' });
	await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
});

test('Cancel discards the edits and keeps the filter', async () => {
	const { screen, onchange, onremove } = setup('city', city);

	await screen.getByRole('button', { name: 'Edit filter' }).click();
	await screen.getByRole('textbox', { name: 'Value' }).fill('Dallas');
	await screen.getByRole('button', { name: 'Cancel' }).click();

	expect(onchange).not.toHaveBeenCalled();
	expect(onremove).not.toHaveBeenCalled();
	await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
});

test('reopens from the saved filter, not from discarded edits', async () => {
	const { screen } = setup('city', city);

	await screen.getByRole('button', { name: 'Edit filter' }).click();
	await screen.getByRole('textbox', { name: 'Value' }).fill('Dallas');
	await screen.getByRole('button', { name: 'Cancel' }).click();
	await screen.getByRole('button', { name: 'Edit filter' }).click();

	await expect.element(screen.getByRole('textbox', { name: 'Value' })).toHaveValue('Austin');
});

test('cannot save a filter that is not complete, and says what is missing', async () => {
	const { screen, onchange } = setup('city', { value: '' });

	await screen.getByRole('button', { name: 'Edit filter' }).click();

	await expect.element(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
	await expect.element(screen.getByRole('status')).toHaveTextContent('City needs a valid value');
	expect(onchange).not.toHaveBeenCalled();
});

test('a filter that was just added opens straight away and says Add filter', async () => {
	const { screen } = setup('city', { value: '' }, { startOpen: true });

	await expect.element(screen.getByRole('dialog')).toBeVisible();
	await expect.element(screen.getByRole('button', { name: 'Add filter', exact: true })).toBeVisible();
});

test('cancelling a filter that was just added removes it', async () => {
	const { screen, onremove } = setup('city', { value: '' }, { startOpen: true });

	await screen.getByRole('button', { name: 'Cancel' }).click();

	expect(onremove).toHaveBeenCalledTimes(1);
});

test('saving a filter that was just added keeps it', async () => {
	const { screen, onchange, onremove, full } = setup('city', { value: '' }, { startOpen: true });

	await screen.getByRole('textbox', { name: 'Value' }).fill('Austin');
	await screen.getByRole('button', { name: 'Add filter', exact: true }).click();

	expect(onchange).toHaveBeenCalledWith({ ...full, value: 'Austin' });
	expect(onremove).not.toHaveBeenCalled();
});

test('calls onremove', async () => {
	const { screen, onremove } = setup('city', city);

	await screen.getByRole('button', { name: 'Remove filter' }).click();

	expect(onremove).toHaveBeenCalledTimes(1);
});

test('shows a grip only when it can be dragged', async () => {
	const withoutGrip = setup('city', city);
	await expect.element(withoutGrip.screen.getByRole('button', { name: 'Drag to reorder' })).not.toBeInTheDocument();
	withoutGrip.screen.unmount();

	const { screen } = setup('city', city, { ondragstart: () => {} });
	await expect.element(screen.getByRole('button', { name: 'Drag to reorder' })).toBeVisible();
});

test('keeps a long sentence on one line that scrolls', async () => {
	const { screen } = setup('contact_made', { value: defaultContactMade() });

	const line = screen.container.querySelector('p')!;
	expect(line.className).toContain('overflow-x-auto');
	expect(line.className).toContain('whitespace-nowrap');
});

test('the operation choices use the wording of the sentence', async () => {
	const { screen } = setup('radius_from_point', {
		operation: 'within',
		value: { latitude: 40.0259, longitude: -75.2238, radius: 2 }
	});

	await screen.getByRole('button', { name: 'Edit filter' }).click();
	await screen.getByRole('button', { name: 'Operation' }).click();

	await expect.element(screen.getByRole('option', { name: 'within' })).toBeInTheDocument();
	await expect.element(screen.getByRole('option', { name: 'outside of' })).toBeInTheDocument();
});

test('a radius filter has a map button on the sentence that opens the picker', async () => {
	const { screen } = setup('radius_from_point', {
		operation: 'within',
		value: { latitude: 40.0259, longitude: -75.2238, radius: 2 }
	});

	await expect.element(screen.getByText(/who reside within 2 miles of 40.0259, -75.2238/)).toBeVisible();
	await screen.getByRole('button', { name: 'View on map' }).click();

	await expect.element(screen.getByText(/Click the map to choose a point/)).toBeVisible();
});

test('a drawn region has a map button too', async () => {
	const { screen } = setup('inside_drawn_region', {
		operation: 'within',
		value: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] }
	});

	await screen.getByRole('button', { name: 'View on map' }).click();

	await expect.element(screen.getByRole('heading', { name: 'Drawn Region' })).toBeVisible();
});

test('edits a contact made filter in the dialog', async () => {
	const { screen, onchange, full } = setup('contact_made', { value: defaultContactMade() });

	await screen.getByRole('button', { name: 'Edit filter' }).click();
	await screen.getByRole('button', { name: 'Attempt' }).click();
	await screen.getByRole('option', { name: 'the latest attempt' }).click();
	await screen.getByRole('button', { name: 'Save' }).click();

	expect(onchange).toHaveBeenCalledWith({
		...full,
		value: { ...defaultContactMade(), position: 'latest' }
	});
});

test('shows the bucket name from the source instead of its id', async () => {
	const source: FilterSource = {
		listBuckets: async () => [{ id: BUCKET, name: 'Philadelphia voters' }],
		listLists: async () => [],
		listSurveys: async () => [],
		listQuestions: async () => []
	};
	const filter: Filter = {
		item: 'contact_made',
		operation: 'equals',
		value: { ...defaultContactMade(), bucketId: BUCKET }
	};
	const screen = render(FilterRow, {
		props: { definition: getFilter('contact_made')!, filter, onchange: () => {}, onremove: () => {} },
		context: new Map([[FILTER_SOURCE_KEY, source]])
	});

	await expect.element(screen.getByText(/in Philadelphia voters/)).toBeVisible();
});
