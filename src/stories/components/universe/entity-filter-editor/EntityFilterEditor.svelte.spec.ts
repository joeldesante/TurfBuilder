import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
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

	await expect.element(getByText('No filters added yet.')).not.toBeInTheDocument();
	await expect.element(getByRole('textbox', { name: 'Value' })).toBeVisible();
	await expect.element(getByRole('heading', { name: 'Add a Filter' })).not.toBeInTheDocument();
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

test('reflects edits in the bound group', async () => {
	const { getByRole } = render(EntityFilterEditor, {
		props: { group: { operator: 'AND', filters: [{ item: 'city', operation: 'equals', value: '' }] } }
	});

	await getByRole('textbox', { name: 'Value' }).fill('Austin');

	await expect.element(getByRole('textbox', { name: 'Value' })).toHaveValue('Austin');
});
