import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import ContactSchemasPage from './ContactSchemasPage.svelte';
import type { ContactSchema } from '$lib/shared/types/contact-schemas';

const NAME = '11111111-1111-4111-8111-111111111111';
const OPEN = '22222222-2222-4222-8222-222222222222';
const CAPACITY = '33333333-3333-4333-8333-333333333333';
const uuid = expect.stringMatching(/^[0-9a-f-]{36}$/);

const business: ContactSchema = {
	id: 's1',
	org_id: 'o1',
	schema_name: 'Business',
	fields: [
		{ id: NAME, name: 'name', type: 'text', required: true },
		{ id: OPEN, name: 'open', type: 'boolean', required: false }
	],
	identifier_field_id: NAME,
	contact_count: 0,
	created_at: '',
	updated_at: ''
};
const venue: ContactSchema = {
	id: 's2',
	org_id: 'o1',
	schema_name: 'Venue',
	fields: [{ id: CAPACITY, name: 'capacity', type: 'number', required: false }],
	identifier_field_id: null,
	contact_count: 2,
	created_at: '',
	updated_at: ''
};

function props(over = {}) {
	return {
		schemas: [business, venue],
		onCreate: vi.fn().mockResolvedValue(undefined),
		onUpdate: vi.fn().mockResolvedValue(undefined),
		onDelete: vi.fn().mockResolvedValue(undefined),
		...over
	};
}

describe('ContactSchemasPage', () => {
	it('lists each schema with its fields, which are required, and how many contacts use it', async () => {
		render(ContactSchemasPage, props());

		await expect.element(page.getByText('Business')).toBeVisible();
		await expect.element(page.getByText('name (Text, required), open (True/False)')).toBeVisible();
		await expect.element(page.getByText('2 contacts')).toBeVisible();
		await expect.element(page.getByText('Not used')).toBeVisible();
	});

	it("shows each schema's identifier, or the full address when it has none", async () => {
		render(ContactSchemasPage, props());

		await expect.element(page.getByRole('cell', { name: 'name', exact: true })).toBeVisible();
		await expect.element(page.getByRole('cell', { name: 'Full address' })).toBeVisible();
	});

	it('only lets a schema that is not in use be deleted', async () => {
		render(ContactSchemasPage, props());

		await expect.element(page.getByRole('button', { name: 'Delete Business' })).toBeEnabled();
		await expect.element(page.getByRole('button', { name: 'Delete Venue' })).toBeDisabled();
	});

	it('calls onDelete with the schema id', async () => {
		const onDelete = vi.fn().mockResolvedValue(undefined);
		render(ContactSchemasPage, props({ onDelete }));

		await page.getByRole('button', { name: 'Delete Business' }).click();

		expect(onDelete).toHaveBeenCalledWith('s1');
	});

	it('creates a schema from the form, giving each new field its own id', async () => {
		const onCreate = vi.fn().mockResolvedValue(undefined);
		render(ContactSchemasPage, props({ onCreate }));

		await page.getByRole('button', { name: 'New schema' }).click();
		await page.getByLabelText('Schema name').fill('Church');
		await page.getByLabelText('Field name 1').fill('members');
		await page.getByLabelText('Type of field 1').selectOptions('number');
		await page.getByRole('button', { name: 'Save' }).click();

		expect(onCreate).toHaveBeenCalledWith({
			schema_name: 'Church',
			fields: [{ id: uuid, name: 'members', type: 'number', required: false }],
			identifier_field_id: null
		});
	});

	it('refuses a field listed twice, even with different capital letters, without calling onCreate', async () => {
		const onCreate = vi.fn();
		render(ContactSchemasPage, props({ onCreate }));

		await page.getByRole('button', { name: 'New schema' }).click();
		await page.getByLabelText('Schema name').fill('Church');
		await page.getByLabelText('Field name 1').fill('Name');
		await page.getByRole('button', { name: 'Add field' }).click();
		await page.getByLabelText('Field name 2').fill('name');
		await page.getByRole('button', { name: 'Save' }).click();

		await expect.element(page.getByRole('alert')).toHaveTextContent('listed twice');
		expect(onCreate).not.toHaveBeenCalled();
	});

	it('shows the error when saving fails and keeps the form open', async () => {
		const onCreate = vi
			.fn()
			.mockRejectedValue(new Error('A schema with that name already exists.'));
		render(ContactSchemasPage, props({ onCreate }));

		await page.getByRole('button', { name: 'New schema' }).click();
		await page.getByLabelText('Schema name').fill('Business');
		await page.getByLabelText('Field name 1').fill('a');
		await page.getByRole('button', { name: 'Save' }).click();

		await expect.element(page.getByRole('alert')).toHaveTextContent('already exists');
	});

	it('edits a schema with its fields filled in, and a rename keeps the field id', async () => {
		const onUpdate = vi.fn().mockResolvedValue(undefined);
		render(ContactSchemasPage, props({ onUpdate }));

		await page.getByRole('button', { name: 'Edit Business' }).click();
		await expect.element(page.getByLabelText('Schema name')).toHaveValue('Business');
		await page.getByLabelText('Schema name').fill('Shop');
		await page.getByLabelText('Field name 1').fill('title');
		await page.getByRole('button', { name: 'Save' }).click();

		expect(onUpdate).toHaveBeenCalledWith('s1', {
			schema_name: 'Shop',
			fields: [
				{ id: NAME, name: 'title', type: 'text', required: true },
				{ id: OPEN, name: 'open', type: 'boolean', required: false }
			],
			// The identifier is the same field, found by its id, not its name.
			identifier_field_id: NAME
		});
	});

	it('marks a field required, and always requires the identifier', async () => {
		const onCreate = vi.fn().mockResolvedValue(undefined);
		render(ContactSchemasPage, props({ onCreate }));

		await page.getByRole('button', { name: 'New schema' }).click();
		await page.getByLabelText('Schema name').fill('Church');
		await page.getByLabelText('Field name 1').fill('title');
		await page.getByRole('button', { name: 'Add field' }).click();
		await page.getByLabelText('Field name 2').fill('members');
		await page.getByLabelText('Type of field 2').selectOptions('number');
		await page.getByRole('checkbox', { name: 'Field 2 is required' }).click();
		await page.getByLabelText('Identifier').selectOptions('title');

		// The identifier cannot be made optional.
		await expect.element(page.getByRole('checkbox', { name: 'Field 1 is required' })).toBeChecked();
		await expect
			.element(page.getByRole('checkbox', { name: 'Field 1 is required' }))
			.toBeDisabled();

		await page.getByRole('button', { name: 'Save' }).click();

		const [input] = onCreate.mock.calls[0];
		expect(input.fields).toEqual([
			{ id: uuid, name: 'title', type: 'text', required: true },
			{ id: uuid, name: 'members', type: 'number', required: true }
		]);
		expect(input.identifier_field_id).toBe(input.fields[0].id);
	});

	it('only offers text fields as the identifier', async () => {
		render(ContactSchemasPage, props());

		await page.getByRole('button', { name: 'New schema' }).click();
		await page.getByLabelText('Field name 1').fill('count');
		await page.getByLabelText('Type of field 1').selectOptions('number');

		const options = await page.getByLabelText('Identifier').getByRole('option').all();
		expect(options.map((o) => o.element().textContent?.trim())).toEqual(['Full address (default)']);
	});

	it('falls back to the default identifier when its field is removed', async () => {
		const onCreate = vi.fn().mockResolvedValue(undefined);
		render(ContactSchemasPage, props({ onCreate }));

		await page.getByRole('button', { name: 'New schema' }).click();
		await page.getByLabelText('Schema name').fill('Church');
		await page.getByLabelText('Field name 1').fill('title');
		await page.getByRole('button', { name: 'Add field' }).click();
		await page.getByLabelText('Field name 2').fill('city');
		await page.getByLabelText('Identifier').selectOptions('title');
		await page.getByRole('button', { name: 'Remove field 1' }).click();
		await page.getByRole('button', { name: 'Save' }).click();

		expect(onCreate).toHaveBeenCalledWith({
			schema_name: 'Church',
			fields: [{ id: uuid, name: 'city', type: 'text', required: false }],
			identifier_field_id: null
		});
	});

	it('locks the type of a field once contacts use the schema, but not its name', async () => {
		render(ContactSchemasPage, props());

		await page.getByRole('button', { name: 'Edit Venue' }).click();

		await expect.element(page.getByLabelText('Type of field 1')).toBeDisabled();
		await expect.element(page.getByLabelText('Field name 1')).toBeEnabled();
	});

	it('lets a new field in a schema that is in use choose its type', async () => {
		render(ContactSchemasPage, props());

		await page.getByRole('button', { name: 'Edit Venue' }).click();
		await page.getByRole('button', { name: 'Add field' }).click();

		await expect.element(page.getByLabelText('Type of field 2')).toBeEnabled();
	});
});
