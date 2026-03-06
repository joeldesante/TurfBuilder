import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FormFieldTextInput from '../../__tests__/FormFieldTextInput.svelte';
import FormFieldCheckbox from '../../__tests__/FormFieldCheckbox.svelte';

describe('FormField', () => {
	describe('label', () => {
		it('renders a visible label', async () => {
			const screen = render(FormFieldTextInput, { label: 'Email address' });

			const label = screen.getByText('Email address');
			await expect.element(label).toBeVisible();
		});

		it('shows required indicator when requirementIndicator is "required"', async () => {
			const screen = render(FormFieldTextInput, {
				label: 'Email',
				requirementIndicator: 'required'
			});

			const indicator = screen.container.querySelector('.text-error');
			expect(indicator).not.toBeNull();
			expect(indicator?.textContent).toBe('*');
		});

		it('shows optional indicator when requirementIndicator is "optional"', async () => {
			const screen = render(FormFieldTextInput, {
				label: 'Email',
				requirementIndicator: 'optional'
			});

			const optional = screen.getByText('Optional');
			await expect.element(optional).toBeVisible();
		});
	});

	describe('helper text', () => {
		it('renders helper text when provided', async () => {
			const screen = render(FormFieldTextInput, {
				label: 'Email',
				helperText: 'We will never share your email.'
			});

			const helper = screen.getByText('We will never share your email.');
			await expect.element(helper).toBeVisible();
		});

		it('does not render helper text when not provided', async () => {
			const screen = render(FormFieldTextInput, { label: 'Email' });

			const helper = screen.container.querySelector('[id$="-helper"]');
			expect(helper).toBeNull();
		});
	});

	describe('error display', () => {
		it('does not show errors when dirty is false even with errors', async () => {
			const screen = render(FormFieldTextInput, {
				label: 'Email',
				dirty: false,
				errors: ['Email is required']
			});

			const alert = screen.container.querySelector('[role="alert"]');
			expect(alert).toBeNull();
		});

		it('shows error messages with role="alert" when dirty and errors exist', async () => {
			const screen = render(FormFieldTextInput, {
				label: 'Email',
				dirty: true,
				errors: ['Email is required']
			});

			const alert = screen.getByRole('alert');
			await expect.element(alert).toBeVisible();
			await expect.element(alert).toHaveTextContent('Email is required');
		});

		it('renders multiple error messages', async () => {
			const screen = render(FormFieldTextInput, {
				label: 'Email',
				dirty: true,
				errors: ['Email is required', 'Must be a valid email']
			});

			const alert = screen.getByRole('alert');
			await expect.element(alert).toHaveTextContent('Email is required');
			await expect.element(alert).toHaveTextContent('Must be a valid email');
		});
	});

	describe('context propagation', () => {
		it('child TextInput inherits disabled from FormField', async () => {
			const screen = render(FormFieldTextInput, {
				label: 'Email',
				disabled: true
			});

			const input = screen.getByRole('textbox');
			await expect.element(input).toHaveAttribute('disabled');
		});

		it('child TextInput gets aria-invalid when FormField is dirty with errors', async () => {
			const screen = render(FormFieldTextInput, {
				label: 'Email',
				dirty: true,
				errors: ['Invalid email']
			});

			const input = screen.getByRole('textbox');
			await expect.element(input).toHaveAttribute('aria-invalid', 'true');
		});

		it('child TextInput gets aria-describedby linking to error and helper', async () => {
			const screen = render(FormFieldTextInput, {
				label: 'Email',
				dirty: true,
				errors: ['Required'],
				helperText: 'Enter your work email'
			});

			const input = screen.getByRole('textbox');
			const describedBy = input.element().getAttribute('aria-describedby');
			expect(describedBy).toBeTruthy();
			// Should reference both error and helper ids
			const ids = describedBy!.split(' ');
			expect(ids.length).toBeGreaterThanOrEqual(2);
			// Verify each referenced ID actually exists in the DOM
			for (const id of ids) {
				expect(screen.container.querySelector(`#${id}`)).not.toBeNull();
			}
		});

		it('child Checkbox inherits disabled from FormField', async () => {
			const screen = render(FormFieldCheckbox, {
				label: 'Terms',
				disabled: true
			});

			const checkbox = screen.getByRole('checkbox');
			await expect.element(checkbox).toHaveAttribute('disabled');
		});
	});
});
