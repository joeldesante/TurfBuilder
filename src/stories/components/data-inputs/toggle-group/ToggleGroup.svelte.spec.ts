import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ToggleGroup from './ToggleGroup.svelte';

const testItems = [
	{ value: 'list', label: 'List' },
	{ value: 'grid', label: 'Grid' },
	{ value: 'map', label: 'Map' }
];

describe('ToggleGroup', () => {
	describe('rendering', () => {
		it('renders a fieldset with legend containing the label', async () => {
			const screen = render(ToggleGroup, {
				label: 'View',
				items: testItems
			});

			const legend = screen.container.querySelector('legend');
			expect(legend).not.toBeNull();
			expect(legend?.textContent).toContain('View');
		});

		it('renders one toggle button per item', async () => {
			const screen = render(ToggleGroup, {
				label: 'View',
				items: testItems
			});

			const listLabel = screen.getByText('List');
			await expect.element(listLabel).toBeVisible();
			const gridLabel = screen.getByText('Grid');
			await expect.element(gridLabel).toBeVisible();
			const mapLabel = screen.getByText('Map');
			await expect.element(mapLabel).toBeVisible();
		});

		it('shows required indicator when requirement is "required"', async () => {
			const screen = render(ToggleGroup, {
				label: 'View',
				items: testItems,
				requirement: 'required'
			});

			const indicator = screen.container.querySelector('.text-error');
			expect(indicator?.textContent).toBe('*');
		});

		it('shows optional indicator when requirement is "optional"', async () => {
			const screen = render(ToggleGroup, {
				label: 'View',
				items: testItems,
				requirement: 'optional'
			});

			const optional = screen.getByText('Optional');
			await expect.element(optional).toBeVisible();
		});
	});

	describe('helper text', () => {
		it('renders helper text when provided', async () => {
			const screen = render(ToggleGroup, {
				label: 'View',
				items: testItems,
				helperText: 'Choose how to display results.'
			});

			const helper = screen.getByText('Choose how to display results.');
			await expect.element(helper).toBeVisible();
		});

		it('hides helper text when errors are shown', async () => {
			const screen = render(ToggleGroup, {
				label: 'View',
				items: testItems,
				helperText: 'Choose how to display results.',
				dirty: true,
				errors: ['Selection required']
			});

			const helper = screen.container.querySelectorAll('p');
			const helperTexts = [...helper].filter(
				(p) => p.textContent === 'Choose how to display results.'
			);
			expect(helperTexts.length).toBe(0);
		});
	});

	describe('validation', () => {
		it('does not show errors when dirty is false', async () => {
			const screen = render(ToggleGroup, {
				label: 'View',
				items: testItems,
				dirty: false,
				errors: ['Please select a view mode']
			});

			const alert = screen.container.querySelector('[role="alert"]');
			expect(alert).toBeNull();
		});

		it('shows errors with role="alert" when dirty and errors exist', async () => {
			const screen = render(ToggleGroup, {
				label: 'View',
				items: testItems,
				dirty: true,
				errors: ['Please select a view mode']
			});

			const alert = screen.getByRole('alert');
			await expect.element(alert).toBeVisible();
			await expect.element(alert).toHaveTextContent('Please select a view mode');
		});

		it('applies error border class to items when invalid', async () => {
			const screen = render(ToggleGroup, {
				label: 'View',
				items: testItems,
				dirty: true,
				errors: ['Required']
			});

			const errorBorderItems = screen.container.querySelectorAll('.border-error');
			expect(errorBorderItems.length).toBe(3);
		});
	});

	describe('disabled state', () => {
		it('disables the fieldset when disabled', async () => {
			const screen = render(ToggleGroup, {
				label: 'View',
				items: testItems,
				disabled: true
			});

			const fieldset = screen.container.querySelector('fieldset');
			expect(fieldset?.hasAttribute('disabled')).toBe(true);
		});

		it('disables individual items when item.disabled is true', async () => {
			const itemsWithDisabled = [
				{ value: 'list', label: 'List' },
				{ value: 'grid', label: 'Grid', disabled: true },
				{ value: 'map', label: 'Map' }
			];

			const screen = render(ToggleGroup, {
				label: 'View',
				items: itemsWithDisabled
			});

			const buttons = screen.container.querySelectorAll('button');
			const disabledButtons = [...buttons].filter((btn) => btn.hasAttribute('disabled'));
			expect(disabledButtons.length).toBe(1);
			expect(disabledButtons[0].textContent).toContain('Grid');
		});
	});
});
