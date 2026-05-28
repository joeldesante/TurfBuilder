import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import BucketEntityFilter from './BucketEntityFilter.svelte';
import type { FilterDefinition } from './BucketEntityFilter.svelte';

const filters: FilterDefinition[] = [
	{
		id: 'last_canvassed',
		label: 'Last Time Canvassed',
		qualifiers: [
			{ value: 'after', label: 'was after' },
			{ value: 'not_after', label: 'was not after' }
		],
		valueType: 'date'
	},
	{
		id: 'distance',
		label: 'Distance From Address',
		qualifiers: [{ value: 'within', label: 'is within' }],
		valueType: 'number',
		valueUnit: 'miles'
	},
	{
		id: 'support_level',
		label: 'Support Level',
		qualifiers: [{ value: 'is', label: 'is' }],
		valueType: 'select',
		valueOptions: [
			{ value: 'strong', label: 'Strong Support' },
			{ value: 'oppose', label: 'Strong Oppose' }
		]
	},
	{
		id: 'first_name',
		label: 'First Name',
		qualifiers: [{ value: 'is', label: 'is' }],
		valueType: 'text',
		valuePlaceholder: 'Enter a name...'
	},
	{
		id: 'has_email',
		label: 'Has Email on File',
		valueType: 'none'
	}
];

test('renders the field selector', async () => {
	const { getByRole } = render(BucketEntityFilter, { props: { filters } });
	await expect.element(getByRole('combobox', { name: 'Filter field' })).toBeVisible();
});

test('does not show qualifier selector when no filter is selected', async () => {
	const { getByRole } = render(BucketEntityFilter, { props: { filters } });
	await expect
		.element(getByRole('combobox', { name: 'Filter qualifier' }))
		.not.toBeInTheDocument();
});

test('does not show value input when no filter is selected', async () => {
	const { getByRole } = render(BucketEntityFilter, { props: { filters } });
	await expect.element(getByRole('combobox', { name: 'Filter value' })).not.toBeInTheDocument();
});

test('pre-selects the given filterId', async () => {
	const { getByRole } = render(BucketEntityFilter, {
		props: { filters, filterId: 'distance' }
	});
	await expect.element(getByRole('combobox', { name: 'Filter field' })).toHaveValue('distance');
});

test('shows qualifier selector when a filter with qualifiers is selected', async () => {
	const { getByRole } = render(BucketEntityFilter, {
		props: { filters, filterId: 'last_canvassed' }
	});
	await expect.element(getByRole('combobox', { name: 'Filter qualifier' })).toBeVisible();
});

test('pre-selects the given qualifierId', async () => {
	const { getByRole } = render(BucketEntityFilter, {
		props: { filters, filterId: 'last_canvassed', qualifierId: 'not_after' }
	});
	await expect
		.element(getByRole('combobox', { name: 'Filter qualifier' }))
		.toHaveValue('not_after');
});

test('renders a date input for date value type', async () => {
	const { getByRole } = render(BucketEntityFilter, {
		props: { filters, filterId: 'last_canvassed', qualifierId: 'after', value: '2024-06-01' }
	});
	// Native date input has implicit role "textbox" in some browsers; check by aria-label
	const dateInput = getByRole('textbox', { name: 'Filter value' });
	await expect.element(dateInput).toBeVisible();
	await expect.element(dateInput).toHaveValue('2024-06-01');
});

test('renders a number input for number value type', async () => {
	const { getByRole } = render(BucketEntityFilter, {
		props: { filters, filterId: 'distance', qualifierId: 'within', value: '10' }
	});
	const numberInput = getByRole('spinbutton', { name: 'Filter value' });
	await expect.element(numberInput).toBeVisible();
	await expect.element(numberInput).toHaveValue('10');
});

test('renders a select input for select value type', async () => {
	const { getByRole } = render(BucketEntityFilter, {
		props: { filters, filterId: 'support_level', qualifierId: 'is', value: 'strong' }
	});
	await expect
		.element(getByRole('combobox', { name: 'Filter value' }))
		.toHaveValue('strong');
});

test('renders a text input for text value type', async () => {
	const { getByRole } = render(BucketEntityFilter, {
		props: { filters, filterId: 'first_name', qualifierId: 'is', value: 'Maria' }
	});
	await expect.element(getByRole('textbox', { name: 'Filter value' })).toHaveValue('Maria');
});

test('renders the unit label when the filter has a valueUnit', async () => {
	const { getByText } = render(BucketEntityFilter, {
		props: { filters, filterId: 'distance', qualifierId: 'within', value: '5' }
	});
	await expect.element(getByText('miles')).toBeVisible();
});

test('does not render a value input for valueType none', async () => {
	const { getByRole } = render(BucketEntityFilter, {
		props: { filters, filterId: 'has_email' }
	});
	// No qualifier and no value input — only the field selector combobox exists
	await expect.element(getByRole('combobox', { name: 'Filter qualifier' })).not.toBeInTheDocument();
	await expect.element(getByRole('combobox', { name: 'Filter value' })).not.toBeInTheDocument();
});

test('renders the remove button when onremove is provided', async () => {
	const { getByRole } = render(BucketEntityFilter, {
		props: { filters, onremove: () => {} }
	});
	await expect.element(getByRole('button', { name: 'Remove filter' })).toBeVisible();
});

test('does not render the remove button when onremove is omitted', async () => {
	const { getByRole } = render(BucketEntityFilter, { props: { filters } });
	await expect
		.element(getByRole('button', { name: 'Remove filter' }))
		.not.toBeInTheDocument();
});

test('calls onremove when the remove button is clicked', async () => {
	let removed = false;
	const { getByRole } = render(BucketEntityFilter, {
		props: { filters, onremove: () => (removed = true) }
	});
	await getByRole('button', { name: 'Remove filter' }).click();
	expect(removed).toBe(true);
});
