import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CheckboxGroup from './CheckboxGroup.svelte';

const testItems = [
	{ value: 'apple', label: 'Apple' },
	{ value: 'banana', label: 'Banana' },
	{ value: 'cherry', label: 'Cherry' }
];

describe('CheckboxGroup', () => {
	describe('rendering', () => {
		it('renders a fieldset with legend containing the label', async () => {
			const screen = render(CheckboxGroup, {
				label: 'Favorite Fruits',
				items: testItems
			});

			const legend = screen.container.querySelector('legend');
			expect(legend).not.toBeNull();
			expect(legend?.textContent).toContain('Favorite Fruits');
		});

		it('renders one checkbox per item', async () => {
			const screen = render(CheckboxGroup, {
				label: 'Fruits',
				items: testItems
			});

			const checkboxes = screen.container.querySelectorAll('[role="checkbox"]');
			expect(checkboxes.length).toBe(3);
		});

		it('shows required indicator when requirementIndicator is "required"', async () => {
			const screen = render(CheckboxGroup, {
				label: 'Fruits',
				items: testItems,
				requirementIndicator: 'required'
			});

			const indicator = screen.container.querySelector('.text-error');
			expect(indicator?.textContent).toBe('*');
		});

		it('shows optional indicator', async () => {
			const screen = render(CheckboxGroup, {
				label: 'Fruits',
				items: testItems,
				requirementIndicator: 'optional'
			});

			const indicator = screen.getByText('Optional');
			await expect.element(indicator).toBeVisible();
		});
	});

	describe('selection', () => {
		it('renders with all checkboxes unchecked by default', async () => {
			const screen = render(CheckboxGroup, {
				label: 'Fruits',
				items: testItems
			});

			const checkboxes = screen.container.querySelectorAll('[role="checkbox"]');
			for (const cb of checkboxes) {
				expect(cb.getAttribute('data-state')).toBe('unchecked');
			}
		});
	});

	describe('validation', () => {
		it('does not show errors when dirty is false', async () => {
			const screen = render(CheckboxGroup, {
				label: 'Fruits',
				items: testItems,
				dirty: false,
				errors: ['Select at least one']
			});

			const alert = screen.container.querySelector('[role="alert"]');
			expect(alert).toBeNull();
		});

		it('shows error with role="alert" when dirty and errors exist', async () => {
			const screen = render(CheckboxGroup, {
				label: 'Fruits',
				items: testItems,
				dirty: true,
				errors: ['Select at least one']
			});

			const alert = screen.getByRole('alert');
			await expect.element(alert).toBeVisible();
			await expect.element(alert).toHaveTextContent('Select at least one');
		});
	});

	describe('disabled state', () => {
		it('disables all checkboxes when group is disabled', async () => {
			const screen = render(CheckboxGroup, {
				label: 'Fruits',
				items: testItems,
				disabled: true
			});

			const checkboxes = screen.container.querySelectorAll('[role="checkbox"]');
			for (const cb of checkboxes) {
				expect(cb.hasAttribute('disabled') || cb.getAttribute('data-disabled') === '').toBe(true);
			}
		});

		it('disables individual items when item.disabled is true', async () => {
			const items = [
				{ value: 'apple', label: 'Apple' },
				{ value: 'banana', label: 'Banana', disabled: true },
				{ value: 'cherry', label: 'Cherry' }
			];

			const screen = render(CheckboxGroup, {
				label: 'Fruits',
				items
			});

			const checkboxes = screen.container.querySelectorAll('[role="checkbox"]');
			// The second checkbox (banana) should be disabled
			expect(
				checkboxes[1].hasAttribute('disabled') || checkboxes[1].getAttribute('data-disabled') === ''
			).toBe(true);
			// The first checkbox (apple) should NOT be disabled
			expect(
				checkboxes[0].hasAttribute('disabled') || checkboxes[0].getAttribute('data-disabled') === ''
			).toBe(false);
		});
	});
});
