import { render } from 'vitest-browser-svelte';
import { afterEach, expect, test, vi } from 'vitest';
import { toast, Toaster } from 'svelte-sonner';
import BucketFiltersPage from './BucketFiltersPage.svelte';
import type { BucketFilters } from '$lib/shared/types/filters';

const austin: BucketFilters = {
	v: 2,
	people: null,
	locations: { operator: 'AND', filters: [{ item: 'city', operation: 'equals', value: 'Austin' }] }
};

afterEach(() => toast.dismiss());

function setup(onSave = vi.fn().mockResolvedValue(undefined), filters = austin) {
	render(Toaster);
	const screen = render(BucketFiltersPage, { props: { bucketName: 'Voters', filters, onSave } });
	return { screen, onSave };
}

/** Changes the city of the first filter to Dallas. */
async function editCity(screen: ReturnType<typeof render>) {
	await screen.getByRole('button', { name: 'Edit filter' }).click();
	await screen.getByRole('textbox', { name: 'Value' }).fill('Dallas');
	await screen.getByRole('button', { name: 'Save', exact: true }).click();
}

test('shows the filters the bucket has now', async () => {
	const { screen } = setup();

	await expect.element(screen.getByRole('heading', { name: 'Filters' })).toBeVisible();
	await expect.element(screen.getByText('Voters')).toBeVisible();
	await expect.element(screen.getByText(/Locations whose city is Austin/)).toBeVisible();
});

test('says changes apply to the bucket but not to lists already made', async () => {
	const { screen } = setup();

	await expect.element(screen.getByText(/Lists already made from it are snapshots/)).toBeVisible();
});

test('has nothing to save until something changes', async () => {
	const { screen } = setup();

	await expect.element(screen.getByRole('button', { name: 'Save Filters' })).toBeDisabled();
	await expect.element(screen.getByRole('button', { name: 'Discard Changes' })).toBeDisabled();
});

test('an edit marks the page as having unsaved changes', async () => {
	const { screen } = setup();

	await editCity(screen);

	await expect.element(screen.getByRole('button', { name: 'Save Filters' })).toBeEnabled();
	await expect.element(screen.getByRole('status')).toHaveTextContent('Unsaved changes');
});

test('saves the edited filters, and says so', async () => {
	const { screen, onSave } = setup();

	await editCity(screen);
	await screen.getByRole('button', { name: 'Save Filters' }).click();

	await vi.waitFor(() =>
		expect(onSave).toHaveBeenCalledWith({
			v: 2,
			people: null,
			locations: { operator: 'AND', filters: [{ item: 'city', operation: 'equals', value: 'Dallas' }] }
		})
	);
	await expect.element(screen.getByText('Filters saved.')).toBeVisible();
	await expect.element(screen.getByRole('button', { name: 'Save Filters' })).toBeDisabled();
});

test('shows why saving failed and keeps the edits', async () => {
	const { screen } = setup(vi.fn().mockRejectedValue(new Error('A filter could not run.')));

	await editCity(screen);
	await screen.getByRole('button', { name: 'Save Filters' }).click();

	await expect.element(screen.getByText('A filter could not run.')).toBeVisible();
	await expect.element(screen.getByText(/city is Dallas/)).toBeVisible();
	await expect.element(screen.getByRole('button', { name: 'Save Filters' })).toBeEnabled();
});

test('discarding puts the saved filters back', async () => {
	const { screen, onSave } = setup();

	await editCity(screen);
	await screen.getByRole('button', { name: 'Discard Changes' }).click();

	await expect.element(screen.getByText(/city is Austin/)).toBeVisible();
	await expect.element(screen.getByRole('button', { name: 'Save Filters' })).toBeDisabled();
	expect(onSave).not.toHaveBeenCalled();
});

test('removing a kind of record counts as a change that can be saved', async () => {
	const { screen, onSave } = setup();

	await screen.getByRole('checkbox', { name: 'Locations' }).click();
	await screen.getByRole('checkbox', { name: 'People' }).click();
	await screen.getByRole('button', { name: 'Save Filters' }).click();

	await vi.waitFor(() =>
		expect(onSave).toHaveBeenCalledWith({
			v: 2,
			people: { operator: 'AND', filters: [] },
			locations: null
		})
	);
});

test('adds the filters of a kind of record that was not included', async () => {
	const { screen } = setup();

	await screen.getByRole('checkbox', { name: 'People' }).click();

	await expect.element(screen.getByRole('region', { name: 'People filters' })).toBeVisible();
	await expect.element(screen.getByRole('button', { name: 'Save Filters' })).toBeEnabled();
});

test('says why a bucket whose old filters could not be converted has no filters, and starts empty', async () => {
	render(Toaster);
	const screen = render(BucketFiltersPage, {
		props: {
			bucketName: 'Voters',
			filters: null,
			problem: 'This bucket\'s filters could not be converted: locations: Cannot convert a "attempt" condition',
			onSave: vi.fn()
		}
	});

	await expect.element(screen.getByRole('alert')).toHaveTextContent('could not be converted');
	await expect.element(screen.getByRole('alert')).toHaveTextContent('Cannot convert a "attempt" condition');
	await expect.element(screen.getByRole('checkbox', { name: 'Locations' })).not.toBeChecked();
});

test('lets an unconverted bucket be rebuilt and saved, after which the warning goes', async () => {
	const onSave = vi.fn().mockResolvedValue(undefined);
	render(Toaster);
	const screen = render(BucketFiltersPage, {
		props: { bucketName: 'Voters', filters: null, problem: 'could not be converted', onSave }
	});

	await screen.getByRole('checkbox', { name: 'Locations' }).click();
	await screen.getByRole('button', { name: 'Save Filters' }).click();

	await vi.waitFor(() =>
		expect(onSave).toHaveBeenCalledWith({
			v: 2,
			people: null,
			locations: { operator: 'AND', filters: [] }
		})
	);
	await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
});

test('shows no warning for a bucket that converted', async () => {
	const { screen } = setup();

	await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
});
