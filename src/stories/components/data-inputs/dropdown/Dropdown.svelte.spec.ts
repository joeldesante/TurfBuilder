import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import Dropdown from './Dropdown.svelte';

const items = [
	{ value: 'and', label: 'All of the following' },
	{ value: 'or', label: 'At least one of the following' }
];

const base = { items, 'aria-label': 'Operator' };

test('shows the selected label on the trigger', async () => {
	const { getByRole } = render(Dropdown, { props: { ...base, value: 'and' } });

	await expect
		.element(getByRole('button', { name: 'Operator' }))
		.toHaveTextContent('All of the following');
});

test('shows the placeholder when nothing is selected', async () => {
	const { getByRole } = render(Dropdown, { props: { ...base, placeholder: 'Choose one...' } });

	await expect
		.element(getByRole('button', { name: 'Operator' }))
		.toHaveTextContent('Choose one...');
});

test('opens a list of options and reports the chosen one', async () => {
	const onValueChange = vi.fn();
	const { getByRole } = render(Dropdown, { props: { ...base, value: 'and', onValueChange } });

	await getByRole('button', { name: 'Operator' }).click();
	await getByRole('option', { name: 'At least one of the following' }).click();

	expect(onValueChange).toHaveBeenCalledWith('or');
	await expect
		.element(getByRole('button', { name: 'Operator' }))
		.toHaveTextContent('At least one of the following');
});

test('does not open while disabled', async () => {
	const { getByRole } = render(Dropdown, { props: { ...base, value: 'and', disabled: true } });

	await expect.element(getByRole('button', { name: 'Operator' })).toBeDisabled();
});

test('the small size is a compact pill', async () => {
	const { getByRole } = render(Dropdown, { props: { ...base, value: 'and', size: 'sm' } });

	await expect
		.element(getByRole('button', { name: 'Operator' }))
		.toHaveClass('h-8', 'rounded-full');
});

test('shows a heading above the options', async () => {
	const { getByRole, getByText } = render(Dropdown, {
		props: { ...base, value: 'and', heading: 'Page Size' }
	});

	await getByRole('button', { name: 'Operator' }).click();
	await expect.element(getByText('Page Size')).toBeVisible();
});

const grouped = [
	{ value: 'none', label: 'Do not import' },
	{ value: 'lat', label: 'Latitude', group: 'Contact data' },
	{ value: 'city', label: 'City', group: 'Contact data' },
	{ value: 'name', label: 'name', group: 'Business fields' }
];

test('shows a heading once above each run of grouped options', async () => {
	const { getByRole, getByText } = render(Dropdown, {
		props: { items: grouped, 'aria-label': 'Field' }
	});

	await getByRole('button', { name: 'Field' }).click();

	await expect.element(getByText('Contact data')).toBeVisible();
	await expect.element(getByText('Business fields')).toBeVisible();
	expect(document.querySelectorAll('[data-group-heading]')).toHaveLength(2);
});

test('shows no heading for options without a group', async () => {
	const { getByRole } = render(Dropdown, {
		props: {
			items: [
				{ value: 'a', label: 'A' },
				{ value: 'b', label: 'B' }
			],
			'aria-label': 'Field'
		}
	});

	await getByRole('button', { name: 'Field' }).click();

	await expect.element(getByRole('option', { name: 'A' })).toBeVisible();
	expect(document.querySelectorAll('[data-group-heading]')).toHaveLength(0);
});

test('puts the headings in the list in order, between the options they introduce', async () => {
	const { getByRole } = render(Dropdown, { props: { items: grouped, 'aria-label': 'Field' } });

	await getByRole('button', { name: 'Field' }).click();
	await expect.element(getByRole('option', { name: 'Latitude' })).toBeVisible();

	const order = Array.from(document.querySelectorAll('[role="option"], [data-group-heading]')).map(
		(el) => el.textContent?.trim()
	);
	expect(order).toEqual([
		'Do not import',
		'Contact data',
		'Latitude',
		'City',
		'Business fields',
		'name'
	]);
});

test('the headings are not options: picking is still by the options only', async () => {
	const onValueChange = vi.fn();
	const { getByRole } = render(Dropdown, {
		props: { items: grouped, 'aria-label': 'Field', onValueChange }
	});

	await getByRole('button', { name: 'Field' }).click();
	await getByRole('option', { name: 'City' }).click();

	expect(onValueChange).toHaveBeenCalledWith('city');
	expect((await getByRole('option').all()).length).toBe(0);
});
