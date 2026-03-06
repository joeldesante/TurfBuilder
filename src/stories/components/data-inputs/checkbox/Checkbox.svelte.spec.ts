import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Checkbox from './Checkbox.svelte';
import FormFieldCheckbox from '../../__tests__/FormFieldCheckbox.svelte';
import { createChildrenSnippet, createFormFieldContext } from '../../__tests__/test-utils';

describe('Checkbox', () => {
	describe('rendering', () => {
		it('renders checkbox with label when children snippet is provided', async () => {
			const screen = render(Checkbox, {
				children: createChildrenSnippet('Accept terms')
			});

			const checkbox = screen.getByRole('checkbox');
			await expect.element(checkbox).toBeVisible();

			const label = screen.getByText('Accept terms');
			await expect.element(label).toBeVisible();
		});

		it('renders checkbox without label when no children', async () => {
			const screen = render(Checkbox);

			const checkbox = screen.getByRole('checkbox');
			await expect.element(checkbox).toBeVisible();

			const labels = screen.container.querySelectorAll('label');
			expect(labels.length).toBe(0);
		});
	});

	describe('states', () => {
		it('shows unchecked state by default', async () => {
			const screen = render(Checkbox, {
				children: createChildrenSnippet('Terms')
			});

			const checkbox = screen.getByRole('checkbox');
			expect(checkbox.element().getAttribute('data-state')).toBe('unchecked');
		});

		it('shows checked state when checked prop is true', async () => {
			const screen = render(Checkbox, {
				checked: true,
				children: createChildrenSnippet('Terms')
			});

			const checkbox = screen.getByRole('checkbox');
			expect(checkbox.element().getAttribute('data-state')).toBe('checked');
		});

		it('shows indeterminate state', async () => {
			const screen = render(Checkbox, {
				indeterminate: true,
				children: createChildrenSnippet('Select all')
			});

			const checkbox = screen.getByRole('checkbox');
			expect(checkbox.element().getAttribute('data-state')).toBe('indeterminate');
		});
	});

	describe('interaction', () => {
		it('toggles to checked when clicked', async () => {
			const screen = render(Checkbox, {
				children: createChildrenSnippet('Terms')
			});

			const checkbox = screen.getByRole('checkbox');
			expect(checkbox.element().getAttribute('data-state')).toBe('unchecked');
			await checkbox.click();
			expect(checkbox.element().getAttribute('data-state')).toBe('checked');
		});

		it('toggles back to unchecked on second click', async () => {
			const screen = render(Checkbox, {
				children: createChildrenSnippet('Terms')
			});

			const checkbox = screen.getByRole('checkbox');
			await checkbox.click();
			expect(checkbox.element().getAttribute('data-state')).toBe('checked');
			await checkbox.click();
			expect(checkbox.element().getAttribute('data-state')).toBe('unchecked');
		});
	});

	describe('FormField context integration', () => {
		it('sets aria-invalid from context.invalid', async () => {
			const screen = render(Checkbox, {
				props: { children: createChildrenSnippet('Terms') },
				context: createFormFieldContext({ invalid: true })
			});

			const checkbox = screen.getByRole('checkbox');
			await expect.element(checkbox).toHaveAttribute('aria-invalid', 'true');
		});

		it('disables when context.disabled is true', async () => {
			const screen = render(FormFieldCheckbox, {
				label: 'Terms',
				disabled: true
			});

			const checkbox = screen.getByRole('checkbox');
			await expect.element(checkbox).toHaveAttribute('disabled');
		});
	});
});
