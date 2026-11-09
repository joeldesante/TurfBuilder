import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RadioGroup from './RadioGroup.svelte';

const testItems = [
	{ value: 'small', label: 'Small' },
	{ value: 'medium', label: 'Medium' },
	{ value: 'large', label: 'Large' }
];

describe('RadioGroup', () => {
	describe('rendering', () => {
		it('renders a fieldset with legend', async () => {
			const screen = render(RadioGroup, {
				label: 'Size',
				items: testItems
			});

			const legend = screen.container.querySelector('legend');
			expect(legend).not.toBeNull();
			expect(legend?.textContent).toContain('Size');
		});

		it('renders one radio button per item with label', async () => {
			const screen = render(RadioGroup, {
				label: 'Size',
				items: testItems
			});

			const radios = screen.container.querySelectorAll('[role="radio"]');
			expect(radios.length).toBe(3);

			const smallLabel = screen.getByText('Small');
			await expect.element(smallLabel).toBeVisible();
		});

		it('shows required indicator when requirement is "required"', async () => {
			const screen = render(RadioGroup, {
				label: 'Size',
				items: testItems,
				requirement: 'required'
			});

			const indicator = screen.container.querySelector('.text-error');
			expect(indicator?.textContent).toBe('*');
		});

		it('shows optional indicator when requirement is "optional"', async () => {
			const screen = render(RadioGroup, {
				label: 'Size',
				items: testItems,
				requirement: 'optional'
			});

			const optional = screen.getByText('Optional');
			await expect.element(optional).toBeVisible();
		});
	});

	describe('validation', () => {
		it('does not show errors when dirty is false', async () => {
			const screen = render(RadioGroup, {
				label: 'Size',
				items: testItems,
				dirty: false,
				errors: ['Please select a size']
			});

			const alert = screen.container.querySelector('[role="alert"]');
			expect(alert).toBeNull();
		});

		it('shows errors with role="alert" when dirty and errors exist', async () => {
			const screen = render(RadioGroup, {
				label: 'Size',
				items: testItems,
				dirty: true,
				errors: ['Please select a size']
			});

			const alert = screen.getByRole('alert');
			await expect.element(alert).toBeVisible();
			await expect.element(alert).toHaveTextContent('Please select a size');
		});

		it('disables all items when group disabled', async () => {
			const screen = render(RadioGroup, {
				label: 'Size',
				items: testItems,
				disabled: true
			});

			const fieldset = screen.container.querySelector('fieldset');
			expect(fieldset?.hasAttribute('disabled')).toBe(true);
		});
	});

	describe('descriptions', () => {
		const described = [
			{ value: 'free', label: 'Free', description: 'One organizer.' },
			{ value: 'team', label: 'Team' }
		];

		it('shows an item description under its label', async () => {
			const screen = render(RadioGroup, { label: 'Plan', items: described });

			await expect.element(screen.getByText('One organizer.')).toBeVisible();
		});

		it('describes the radio with its description, without adding it to the name', async () => {
			const screen = render(RadioGroup, { label: 'Plan', items: described });

			const radio = screen.getByRole('radio', { name: 'Free', exact: true });
			await expect.element(radio).toHaveAccessibleDescription('One organizer.');
		});

		it('leaves items without a description undescribed', async () => {
			const screen = render(RadioGroup, { label: 'Plan', items: described });

			const radio = screen.getByRole('radio', { name: 'Team' });
			await expect.element(radio).not.toHaveAttribute('aria-describedby');
		});
	});
});
