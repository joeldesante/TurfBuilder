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

	await expect.element(getByRole('button', { name: 'Operator' })).toHaveTextContent('Choose one...');
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
