import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import EntityFilterEditor from './EntityFilterEditor.svelte';

test('starts with an empty root group', async () => {
	const { getByText, getByRole } = render(EntityFilterEditor);

	await expect.element(getByText('No filters added yet.')).toBeVisible();
	await expect.element(getByRole('button', { name: 'Group operator' })).toBeVisible();
});

test('the root group cannot be removed', async () => {
	const { getByRole } = render(EntityFilterEditor);

	await expect.element(getByRole('button', { name: 'Remove group' })).not.toBeInTheDocument();
});

test('adds the chosen filter to the root group and closes the catalog', async () => {
	const { getByRole, getByText } = render(EntityFilterEditor);

	await getByRole('button', { name: 'Add Filter' }).click();
	await getByRole('button', { name: 'City' }).click();

	await expect.element(getByRole('heading', { name: 'Add a Filter' })).not.toBeInTheDocument();
	await expect.element(getByText('No filters added yet.')).not.toBeInTheDocument();
});

test('opens the new filter to be configured as soon as it is added', async () => {
	const { getByRole } = render(EntityFilterEditor);

	await getByRole('button', { name: 'Add Filter' }).click();
	await getByRole('button', { name: 'City' }).click();

	await expect.element(getByRole('dialog')).toBeVisible();
	await expect.element(getByRole('heading', { name: 'City' })).toBeVisible();
	await expect.element(getByRole('textbox', { name: 'Value' })).toBeVisible();
});

test('adding a filter and saving it shows it as a sentence', async () => {
	const { getByRole, getByText } = render(EntityFilterEditor, { props: { entity: 'locations' } });

	await getByRole('button', { name: 'Add Filter' }).click();
	await getByRole('button', { name: 'City' }).click();
	await getByRole('textbox', { name: 'Value' }).fill('Austin');
	await getByRole('button', { name: 'Add filter', exact: true }).click();

	await expect.element(getByRole('dialog')).not.toBeInTheDocument();
	await expect.element(getByText(/Locations whose city is Austin/)).toBeVisible();
});

test('cancelling a filter that was just added takes it back out', async () => {
	const { getByRole, getByText } = render(EntityFilterEditor);

	await getByRole('button', { name: 'Add Filter' }).click();
	await getByRole('button', { name: 'City' }).click();
	await getByRole('button', { name: 'Cancel' }).click();

	await expect.element(getByText('No filters added yet.')).toBeVisible();
});

test('nests a group that can be removed', async () => {
	const { getByRole, getByText } = render(EntityFilterEditor);

	await getByRole('button', { name: 'Add Filter' }).click();
	await getByRole('button', { name: 'Filter Group' }).click();
	await expect.element(getByRole('button', { name: 'Remove group' })).toBeVisible();

	await getByRole('button', { name: 'Remove group' }).click();

	await expect.element(getByRole('button', { name: 'Remove group' })).not.toBeInTheDocument();
	await expect.element(getByText('No filters added yet.')).toBeVisible();
});

test('reflects saved edits in the bound group', async () => {
	const { getByRole, getByText } = render(EntityFilterEditor, {
		props: { group: { operator: 'AND', filters: [{ item: 'city', operation: 'equals', value: 'Dallas' }] } }
	});

	await getByRole('button', { name: 'Edit filter' }).click();
	await getByRole('textbox', { name: 'Value' }).fill('Austin');
	await getByRole('button', { name: 'Save' }).click();

	await expect.element(getByText(/city is Austin/)).toBeVisible();
});

test('discards edits that are cancelled', async () => {
	const { getByRole, getByText } = render(EntityFilterEditor, {
		props: { group: { operator: 'AND', filters: [{ item: 'city', operation: 'equals', value: 'Dallas' }] } }
	});

	await getByRole('button', { name: 'Edit filter' }).click();
	await getByRole('textbox', { name: 'Value' }).fill('Austin');
	await getByRole('button', { name: 'Cancel' }).click();

	await expect.element(getByText(/city is Dallas/)).toBeVisible();
});

test('names the kind of record in the sentences', async () => {
	const { getByText } = render(EntityFilterEditor, {
		props: {
			entity: 'people',
			group: { operator: 'AND', filters: [{ item: 'age', operation: 'greater_than', value: 65 }] }
		}
	});

	await expect.element(getByText(/People whose age is greater than 65 years/)).toBeVisible();
});

test('names the kind of record in the group mode', async () => {
	const { getByRole } = render(EntityFilterEditor, { props: { entity: 'locations' } });

	await expect
		.element(getByRole('button', { name: 'Group operator' }))
		.toHaveTextContent('Locations where every condition below is true');
	await getByRole('button', { name: 'Group operator' }).click();
	await expect
		.element(getByRole('option', { name: 'Locations where no condition below is true' }))
		.toBeInTheDocument();
});

test('reports the whole query after each change', async () => {
	const onchange = vi.fn();
	const { getByRole } = render(EntityFilterEditor, {
		props: { onchange, group: { operator: 'AND', filters: [{ item: 'city', operation: 'equals', value: 'Dallas' }] } }
	});

	await getByRole('button', { name: 'Edit filter' }).click();
	await getByRole('textbox', { name: 'Value' }).fill('Austin');
	await getByRole('button', { name: 'Save' }).click();

	expect(onchange).toHaveBeenLastCalledWith({
		operator: 'AND',
		filters: [{ item: 'city', operation: 'equals', value: 'Austin' }]
	});
});
