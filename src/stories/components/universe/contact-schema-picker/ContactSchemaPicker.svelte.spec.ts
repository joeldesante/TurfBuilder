import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import ContactSchemaPicker from './ContactSchemaPicker.svelte';
import type { FilterSource } from '$lib/client/filter-source';

const CHURCH = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1';
const SHOP = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2';

const schema = (id: string, name: string) => ({
	id,
	org_id: 'o',
	schema_name: name,
	fields: [],
	identifier_field_id: null,
	contact_count: 0,
	created_at: '',
	updated_at: ''
});

function makeSource(overrides: Partial<FilterSource> = {}): FilterSource {
	return {
		listBuckets: async () => [],
		listLists: async () => [],
		listSurveys: async () => [],
		listQuestions: async () => [],
		listSchemas: async () => [schema(CHURCH, 'Church'), schema(SHOP, 'Shop')],
		...overrides
	};
}

test('offers the organization schemas', async () => {
	const { getByRole } = render(ContactSchemaPicker, {
		props: { source: makeSource(), value: null, onchange: () => {} }
	});

	await getByRole('button', { name: 'Schema' }).click();

	await expect.element(getByRole('option', { name: 'Church' })).toBeVisible();
	await expect.element(getByRole('option', { name: 'Shop' })).toBeVisible();
});

test('reports the schema id when one is chosen', async () => {
	const onchange = vi.fn();
	const { getByRole } = render(ContactSchemaPicker, {
		props: { source: makeSource(), value: null, onchange }
	});

	await getByRole('button', { name: 'Schema' }).click();
	await getByRole('option', { name: 'Shop' }).click();

	expect(onchange).toHaveBeenCalledWith({ schemaId: SHOP });
});

test('shows the schema that is chosen', async () => {
	const { getByRole } = render(ContactSchemaPicker, {
		props: { source: makeSource(), value: { schemaId: CHURCH }, onchange: () => {} }
	});

	await expect.element(getByRole('button', { name: 'Schema' })).toHaveTextContent('Church');
});

test('says so when the chosen schema no longer exists', async () => {
	const { getByRole } = render(ContactSchemaPicker, {
		props: {
			source: makeSource(),
			value: { schemaId: 'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3' },
			onchange: () => {}
		}
	});

	await expect.element(getByRole('alert')).toHaveTextContent('no longer exists');
});

test('says so when the schemas cannot be loaded', async () => {
	const { getByRole } = render(ContactSchemaPicker, {
		props: {
			source: makeSource({ listSchemas: async () => Promise.reject(new Error('down')) }),
			value: null,
			onchange: () => {}
		}
	});

	await expect.element(getByRole('alert')).toHaveTextContent('could not be loaded');
});
