import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Select from './Select.svelte';
import { createFormFieldContext } from '../../__tests__/test-utils';

const testItems = [
	{ value: 'apple', label: 'Apple' },
	{ value: 'banana', label: 'Banana' },
	{ value: 'cherry', label: 'Cherry' }
];

const testGroups = [
	{
		heading: 'Fruits',
		items: [
			{ value: 'apple', label: 'Apple' },
			{ value: 'banana', label: 'Banana' }
		]
	},
	{
		heading: 'Vegetables',
		items: [{ value: 'carrot', label: 'Carrot' }]
	}
];

describe('Select', () => {
	describe('rendering', () => {
		it('renders a native select element', async () => {
			const screen = render(Select, { items: testItems });

			const select = screen.getByRole('combobox');
			await expect.element(select).toBeVisible();
		});

		it('renders option elements from items array', async () => {
			const screen = render(Select, { items: testItems });

			const options = screen.container.querySelectorAll('option:not([disabled])');
			expect(options.length).toBe(3);
		});

		it('renders optgroup elements from groups array', async () => {
			const screen = render(Select, { groups: testGroups });

			const optgroups = screen.container.querySelectorAll('optgroup');
			expect(optgroups.length).toBe(2);
			expect(optgroups[0].getAttribute('label')).toBe('Fruits');
		});

		it('renders placeholder as disabled option', async () => {
			const screen = render(Select, {
				items: testItems,
				placeholder: 'Choose a fruit'
			});

			const placeholder = screen.container.querySelector('option[disabled]');
			expect(placeholder).not.toBeNull();
			expect(placeholder?.textContent).toBe('Choose a fruit');
		});
	});

	describe('FormField context integration', () => {
		it('sets aria-invalid from context', async () => {
			const screen = render(Select, {
				props: { items: testItems },
				context: createFormFieldContext({ invalid: true })
			});

			const select = screen.getByRole('combobox');
			await expect.element(select).toHaveAttribute('aria-invalid', 'true');
		});

		it('disables from context', async () => {
			const screen = render(Select, {
				props: { items: testItems },
				context: createFormFieldContext({ disabled: true })
			});

			const select = screen.getByRole('combobox');
			await expect.element(select).toHaveAttribute('disabled');
		});

		it('uses id from context', async () => {
			const screen = render(Select, {
				props: { items: testItems },
				context: createFormFieldContext({ id: 'fruit-select' })
			});

			const select = screen.container.querySelector('#fruit-select');
			expect(select).not.toBeNull();
		});
	});
});
