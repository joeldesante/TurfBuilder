import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TextInput from './TextInput.svelte';
import InputGroupTextInput from '../../__tests__/InputGroupTextInput.svelte';
import { createFormFieldContext, createInputGroupContext } from '../../__tests__/test-utils';

describe('TextInput', () => {
	describe('standalone (no context)', () => {
		it('renders an input with type="text" by default', async () => {
			const screen = render(TextInput);

			const input = screen.getByRole('textbox');
			await expect.element(input).toBeVisible();
		});

		it('renders with the specified type', async () => {
			const screen = render(TextInput, { type: 'email' });

			const input = screen.container.querySelector('input[type="email"]');
			expect(input).not.toBeNull();
		});

		it('displays placeholder text', async () => {
			const screen = render(TextInput, { placeholder: 'Enter name' });

			const input = screen.getByPlaceholder('Enter name');
			await expect.element(input).toBeVisible();
		});

		it('uses the provided id', async () => {
			const screen = render(TextInput, { id: 'my-input' });

			const input = screen.container.querySelector('#my-input');
			expect(input).not.toBeNull();
		});
	});

	describe('FormField context integration', () => {
		it('uses id from formField context when no id prop given', async () => {
			const screen = render(TextInput, {
				props: {},
				context: createFormFieldContext({ id: 'email-field' })
			});

			const input = screen.container.querySelector('#email-field');
			expect(input).not.toBeNull();
		});

		it('sets aria-invalid="true" when context.invalid is true', async () => {
			const screen = render(TextInput, {
				props: {},
				context: createFormFieldContext({ invalid: true })
			});

			const input = screen.getByRole('textbox');
			await expect.element(input).toHaveAttribute('aria-invalid', 'true');
		});

		it('sets aria-describedby from context.describedBy', async () => {
			const screen = render(TextInput, {
				props: {},
				context: createFormFieldContext({ describedBy: 'helper-1 error-1' })
			});

			const input = screen.getByRole('textbox');
			await expect.element(input).toHaveAttribute('aria-describedby', 'helper-1 error-1');
		});

		it('disables input when context.disabled is true', async () => {
			const screen = render(TextInput, {
				props: {},
				context: createFormFieldContext({ disabled: true })
			});

			const input = screen.getByRole('textbox');
			await expect.element(input).toHaveAttribute('disabled');
		});

		it('does not set aria-invalid when context.invalid is false', async () => {
			const screen = render(TextInput, {
				props: {},
				context: createFormFieldContext({ invalid: false })
			});

			const input = screen.getByRole('textbox');
			expect(input.element().getAttribute('aria-invalid')).toBeNull();
		});
	});

	describe('InputGroup context integration', () => {
		it('removes border when inside an input group', async () => {
			const screen = render(InputGroupTextInput);

			const input = screen.container.querySelector('input');
			expect(input?.classList.contains('border')).toBe(false);
		});
	});
});
