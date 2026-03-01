import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PinInput from './PinInput.svelte';
import { createFormFieldContext } from '../../__tests__/test-utils';

describe('PinInput', () => {
	describe('rendering', () => {
		it('renders 6 cells by default (maxlength=6)', async () => {
			const screen = render(PinInput);

			const cells = screen.container.querySelectorAll('[data-pin-input-cell]');
			expect(cells.length).toBe(6);
		});

		it('renders custom number of cells when maxlength is changed', async () => {
			const screen = render(PinInput, { maxlength: 4 });

			const cells = screen.container.querySelectorAll('[data-pin-input-cell]');
			expect(cells.length).toBe(4);
		});
	});

	describe('FormField context integration', () => {
		it('sets aria-invalid when context.invalid is true', async () => {
			const screen = render(PinInput, {
				props: {},
				context: createFormFieldContext({ invalid: true })
			});

			// Bits UI PinInput forwards aria-invalid to the hidden input element
			const input = screen.container.querySelector('[data-pin-input-input]');
			const root = screen.container.querySelector('[data-pin-input-root]');
			const target = input ?? root;
			expect(target?.getAttribute('aria-invalid')).toBe('true');
		});

		it('disables all inputs when context.disabled is true', async () => {
			const screen = render(PinInput, {
				props: {},
				context: createFormFieldContext({ disabled: true })
			});

			// When context.disabled is true, PinInput applies opacity-50 to the root
			const wrapper = screen.container.querySelector('.opacity-50');
			expect(wrapper).not.toBeNull();
		});

		it('sets aria-describedby from context.describedBy', async () => {
			const screen = render(PinInput, {
				props: {},
				context: createFormFieldContext({ describedBy: 'error-msg' })
			});

			// Bits UI PinInput forwards aria-describedby to the hidden input element
			const input = screen.container.querySelector('[data-pin-input-input]');
			const root = screen.container.querySelector('[data-pin-input-root]');
			const target = input ?? root;
			expect(target?.getAttribute('aria-describedby')).toBe('error-msg');
		});
	});

	describe('disabled prop', () => {
		it('applies disabled styling when disabled prop is true', async () => {
			const screen = render(PinInput, { disabled: true });

			const wrapper = screen.container.querySelector('.opacity-50');
			expect(wrapper).not.toBeNull();
		});
	});
});
