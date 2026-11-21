import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import SchemaFieldPicker from './SchemaFieldPicker.svelte';
import type { FilterSource } from '$lib/client/filter-source';

const CHURCH = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1';
const DENOM = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2';
const MEMBERS = 'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3';
const OPEN = 'd4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4';

const church = {
	id: CHURCH,
	org_id: 'o',
	schema_name: 'Church',
	fields: [
		{ id: DENOM, name: 'Denomination', type: 'text' as const, required: false },
		{ id: MEMBERS, name: 'Members', type: 'number' as const, required: false },
		{ id: OPEN, name: 'Open', type: 'boolean' as const, required: false }
	],
	identifier_field_id: null,
	contact_count: 0,
	created_at: '',
	updated_at: ''
};

function makeSource(overrides: Partial<FilterSource> = {}): FilterSource {
	return {
		listBuckets: async () => [],
		listLists: async () => [],
		listSurveys: async () => [],
		listQuestions: async () => [],
		listSchemas: async () => [church],
		...overrides
	};
}

const at = (fieldId: string, value: unknown = null) => ({ schemaId: CHURCH, fieldId, value }) as never;

test('starts with only the schema choice', async () => {
	const { getByRole } = render(SchemaFieldPicker, {
		props: { source: makeSource(), value: null, onchange: () => {} }
	});

	await expect.element(getByRole('button', { name: 'Schema' })).toBeVisible();
	await expect.element(getByRole('button', { name: 'Field' })).not.toBeInTheDocument();
});

test('choosing a schema reports it and clears what was below it', async () => {
	const onchange = vi.fn();
	const { getByRole } = render(SchemaFieldPicker, {
		props: { source: makeSource(), value: null, onchange }
	});

	await getByRole('button', { name: 'Schema' }).click();
	await getByRole('option', { name: 'Church' }).click();

	expect(onchange).toHaveBeenCalledWith({ schemaId: CHURCH, fieldId: '', value: null });
});

test('offers only the fields of the chosen schema, by name', async () => {
	const { getByRole } = render(SchemaFieldPicker, {
		props: { source: makeSource(), value: { schemaId: CHURCH, fieldId: '', value: null }, onchange: () => {} }
	});

	await getByRole('button', { name: 'Field' }).click();

	await expect.element(getByRole('option', { name: 'Denomination' })).toBeVisible();
	await expect.element(getByRole('option', { name: 'Members' })).toBeVisible();
	await expect.element(getByRole('option', { name: 'Open' })).toBeVisible();
});

test('choosing a field reports its id and starts its value empty, or yes for true/false', async () => {
	const onchange = vi.fn();
	const { getByRole } = render(SchemaFieldPicker, {
		props: { source: makeSource(), value: { schemaId: CHURCH, fieldId: '', value: null }, onchange }
	});

	await getByRole('button', { name: 'Field' }).click();
	await getByRole('option', { name: 'Denomination' }).click();
	expect(onchange).toHaveBeenLastCalledWith({ schemaId: CHURCH, fieldId: DENOM, value: '' });

	await getByRole('button', { name: 'Field' }).click();
	await getByRole('option', { name: 'Members' }).click();
	expect(onchange).toHaveBeenLastCalledWith({ schemaId: CHURCH, fieldId: MEMBERS, value: null });

	await getByRole('button', { name: 'Field' }).click();
	await getByRole('option', { name: 'Open' }).click();
	expect(onchange).toHaveBeenLastCalledWith({ schemaId: CHURCH, fieldId: OPEN, value: true });
});

test('takes text for a text field and a number for a number field', async () => {
	const onchange = vi.fn();
	const text = render(SchemaFieldPicker, {
		props: { source: makeSource(), value: at(DENOM, ''), onchange }
	});

	await text.getByRole('textbox', { name: 'Value' }).fill('Baptist');
	expect(onchange).toHaveBeenLastCalledWith({ schemaId: CHURCH, fieldId: DENOM, value: 'Baptist' });
	text.unmount();

	const number = render(SchemaFieldPicker, {
		props: { source: makeSource(), value: at(MEMBERS), onchange }
	});
	await number.getByRole('spinbutton', { name: 'Value' }).fill('120');
	expect(onchange).toHaveBeenLastCalledWith({ schemaId: CHURCH, fieldId: MEMBERS, value: 120 });
});

test('takes yes or no for a true/false field', async () => {
	const onchange = vi.fn();
	const { getByRole } = render(SchemaFieldPicker, {
		props: { source: makeSource(), value: at(OPEN, true), onchange }
	});

	await getByRole('button', { name: 'Value' }).click();
	await getByRole('option', { name: 'no' }).click();

	expect(onchange).toHaveBeenLastCalledWith({ schemaId: CHURCH, fieldId: OPEN, value: false });
});

test('tells the editor the type of the chosen field, and null when there is none', async () => {
	const ontypechange = vi.fn();
	render(SchemaFieldPicker, {
		props: { source: makeSource(), value: at(MEMBERS), onchange: () => {}, ontypechange }
	});

	await vi.waitFor(() => expect(ontypechange).toHaveBeenLastCalledWith('number'));
});

test('says so when the chosen field was removed from the schema, or the schema itself was', async () => {
	const field = render(SchemaFieldPicker, {
		props: {
			source: makeSource(),
			value: at('e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5', 'x'),
			onchange: () => {}
		}
	});
	await expect.element(field.getByRole('alert')).toHaveTextContent('field no longer exists');
	field.unmount();

	const schema = render(SchemaFieldPicker, {
		props: {
			source: makeSource(),
			value: { schemaId: 'f6f6f6f6-f6f6-46f6-86f6-f6f6f6f6f6f6', fieldId: DENOM, value: 'x' },
			onchange: () => {}
		}
	});
	await expect.element(schema.getByRole('alert')).toHaveTextContent('schema no longer exists');
});
