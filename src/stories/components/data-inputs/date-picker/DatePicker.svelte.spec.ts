import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DatePicker from './DatePicker.svelte';
import { createFormFieldContext } from '../../__tests__/test-utils';

describe('DatePicker', () => {
	describe('rendering', () => {
		it('renders the calendar trigger button', async () => {
			const screen = render(DatePicker);

			const trigger = screen.getByRole('button');
			await expect.element(trigger).toBeVisible();
		});
	});

	describe('props', () => {
		it('applies disabled styles when disabled=true', async () => {
			const screen = render(DatePicker, { disabled: true, id: 'test-date' });

			const input = screen.container.querySelector('#test-date');
			expect(input?.classList.contains('opacity-50')).toBe(true);
		});
	});

	describe('FormField context integration', () => {
		it('uses id from context on the input element', async () => {
			const screen = render(DatePicker, {
				props: {},
				context: createFormFieldContext({ id: 'date-field' })
			});

			const input = screen.container.querySelector('#date-field');
			expect(input).not.toBeNull();
		});

		it('applies error border class when context.invalid is true', async () => {
			const screen = render(DatePicker, {
				props: {},
				context: createFormFieldContext({ invalid: true })
			});

			const input = screen.container.querySelector('#test-field');
			expect(input?.classList.contains('border-error')).toBe(true);
		});

		it('applies disabled styles when context.disabled is true', async () => {
			const screen = render(DatePicker, {
				props: {},
				context: createFormFieldContext({ disabled: true })
			});

			const input = screen.container.querySelector('#test-field');
			expect(input?.classList.contains('opacity-50')).toBe(true);
		});
	});
});
