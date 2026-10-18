import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import ContactMadePicker from './ContactMadePicker.svelte';
import { defaultContactMade } from '$lib/shared/utils/filter-registry';
import type { FilterSource } from '$lib/client/filter-source';
import type { ContactMadeValue } from '$lib/shared/types/filters';

const BUCKET = '11111111-1111-4111-8111-111111111111';
const LIST = '44444444-4444-4444-8444-444444444444';

function makeSource(overrides: Partial<FilterSource> = {}): FilterSource {
	return {
		listBuckets: async () => [{ id: BUCKET, name: 'Voters' }],
		listLists: async () => [{ id: LIST, name: 'Ward 3', entity_type: 'locations' }],
		listSurveys: async () => [],
		listQuestions: async () => [],
		...overrides
	};
}

/** Pass `null` for a picker with no source; leaving it out gives the usual fake one. */
function setup(change: Partial<ContactMadeValue> = {}, source: FilterSource | null = makeSource()) {
	const onchange = vi.fn();
	const value = { ...defaultContactMade(), ...change };
	const screen = render(ContactMadePicker, { props: { source: source ?? undefined, value, onchange } });
	return { screen, onchange, value };
}

test('starts as contact made on any attempt', async () => {
	const { screen } = setup();

	await expect.element(screen.getByRole('button', { name: 'Outcome' })).toHaveTextContent('Contact was made');
	await expect.element(screen.getByRole('button', { name: 'Attempt' })).toHaveTextContent('any attempt');
});

test('reports a changed outcome', async () => {
	const { screen, onchange, value } = setup();

	await screen.getByRole('button', { name: 'Outcome' }).click();
	await screen.getByRole('option', { name: 'No contact was made' }).click();

	expect(onchange).toHaveBeenCalledWith({ ...value, contacted: false });
});

test('picking the latest attempt clears the count', async () => {
	const { screen, onchange, value } = setup({ position: 'nth_from_last', n: 3 });

	await screen.getByRole('button', { name: 'Attempt' }).click();
	await screen.getByRole('option', { name: 'the latest attempt' }).click();

	expect(onchange).toHaveBeenCalledWith({ ...value, position: 'latest', n: null });
});

test('picking an earlier attempt starts at the one before the latest', async () => {
	const { screen, onchange, value } = setup();

	await screen.getByRole('button', { name: 'Attempt' }).click();
	await screen.getByRole('option', { name: 'an earlier attempt' }).click();

	expect(onchange).toHaveBeenCalledWith({ ...value, position: 'nth_from_last', n: 2 });
});

test('asks how far back only for an earlier attempt', async () => {
	const none = setup();
	await expect.element(none.screen.getByRole('spinbutton', { name: 'Attempts back' })).not.toBeInTheDocument();
	none.screen.unmount();

	const { screen, onchange, value } = setup({ position: 'nth_from_last', n: 2 });
	await screen.getByRole('spinbutton', { name: 'Attempts back' }).fill('4');

	expect(onchange).toHaveBeenLastCalledWith({ ...value, n: 4 });
});

test('offers the buckets and reports the one chosen', async () => {
	const { screen, onchange, value } = setup();

	await screen.getByRole('button', { name: 'Bucket' }).click();
	await screen.getByRole('option', { name: 'Voters' }).click();

	expect(onchange).toHaveBeenCalledWith({ ...value, bucketId: BUCKET, listId: null });
});

test('offers lists only once a bucket is chosen', async () => {
	const none = setup();
	await expect.element(none.screen.getByRole('button', { name: 'List' })).not.toBeInTheDocument();
	none.screen.unmount();

	const listLists = vi.fn(async () => [{ id: LIST, name: 'Ward 3', entity_type: 'locations' as const }]);
	const { screen, onchange, value } = setup({ bucketId: BUCKET }, makeSource({ listLists }));
	await screen.getByRole('button', { name: 'List' }).click();
	await screen.getByRole('option', { name: 'Ward 3' }).click();

	expect(listLists).toHaveBeenCalledWith(BUCKET);
	expect(onchange).toHaveBeenCalledWith({ ...value, listId: LIST });
});

test('changing the bucket clears the list', async () => {
	const { screen, onchange, value } = setup({ bucketId: BUCKET, listId: LIST });

	await screen.getByRole('button', { name: 'Bucket' }).click();
	await screen.getByRole('option', { name: 'any bucket' }).click();

	expect(onchange).toHaveBeenCalledWith({ ...value, bucketId: null, listId: null });
});

test('leaves out the bucket and list without a source', async () => {
	const { screen } = setup({}, null);

	await expect.element(screen.getByRole('button', { name: 'Bucket' })).not.toBeInTheDocument();
	await expect.element(screen.getByRole('button', { name: 'Attempt' })).toBeVisible();
});

test('clears the dates', async () => {
	const { screen, onchange, value } = setup({ from: '2026-01-01', to: '2026-01-31' });

	await screen.getByRole('button', { name: 'Clear dates' }).click();

	expect(onchange).toHaveBeenCalledWith({ ...value, from: null, to: null });
});

test('offers to clear dates only when there are some', async () => {
	const { screen } = setup();

	await expect.element(screen.getByRole('button', { name: 'Clear dates' })).not.toBeInTheDocument();
});

test('says so when the choices cannot be loaded', async () => {
	const { screen } = setup({}, makeSource({ listBuckets: async () => Promise.reject(new Error('boom')) }));

	await expect.element(screen.getByText('The bucket and list choices could not be loaded.')).toBeVisible();
});
