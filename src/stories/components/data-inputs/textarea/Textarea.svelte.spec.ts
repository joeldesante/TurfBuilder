import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Textarea from './Textarea.svelte';
import { createFormFieldContext } from '../../__tests__/test-utils';

describe('Textarea', () => {
	describe('rendering', () => {
		it('renders a textarea element', async () => {
			const screen = render(Textarea);

			const textarea = screen.getByRole('textbox');
			await expect.element(textarea).toBeVisible();
		});

		it('displays placeholder text', async () => {
			const screen = render(Textarea, { placeholder: 'Write a message...' });

			const textarea = screen.getByPlaceholder('Write a message...');
			await expect.element(textarea).toBeVisible();
		});

		it('sets rows attribute', async () => {
			const screen = render(Textarea, { rows: 5 });

			const textarea = screen.container.querySelector('textarea');
			expect(textarea?.getAttribute('rows')).toBe('5');
		});
	});

	describe('FormField context integration', () => {
		it('sets aria-invalid from context', async () => {
			const screen = render(Textarea, {
				props: {},
				context: createFormFieldContext({ invalid: true })
			});

			const textarea = screen.getByRole('textbox');
			await expect.element(textarea).toHaveAttribute('aria-invalid', 'true');
		});

		it('disables from context', async () => {
			const screen = render(Textarea, {
				props: {},
				context: createFormFieldContext({ disabled: true })
			});

			const textarea = screen.getByRole('textbox');
			await expect.element(textarea).toHaveAttribute('disabled');
		});
	});
});
