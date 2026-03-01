import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import InputGroupTextInput from '../../__tests__/InputGroupTextInput.svelte';
import InputGroupWithSlots from '../../__tests__/InputGroupWithSlots.svelte';

describe('InputGroup', () => {
	describe('rendering', () => {
		it('renders child input inside a grouped container', async () => {
			const screen = render(InputGroupTextInput);

			const input = screen.getByRole('textbox');
			await expect.element(input).toBeVisible();
		});

		it('applies border and rounded-lg to the wrapper', async () => {
			const screen = render(InputGroupTextInput);

			const wrapper = screen.container.querySelector('.border.rounded-lg');
			expect(wrapper).not.toBeNull();
		});
	});

	describe('slot content', () => {
		it('renders leading slot content', async () => {
			const screen = render(InputGroupWithSlots, {
				showLeading: true,
				leadingText: '@'
			});

			const leading = screen.getByText('@');
			await expect.element(leading).toBeVisible();
		});

		it('renders trailing slot content', async () => {
			const screen = render(InputGroupWithSlots, {
				showTrailing: true,
				trailingText: '.com'
			});

			const trailing = screen.getByText('.com');
			await expect.element(trailing).toBeVisible();
		});
	});

	describe('context', () => {
		it('child input has no border when inside input group', async () => {
			const screen = render(InputGroupTextInput);

			const input = screen.container.querySelector('input');
			expect(input?.classList.contains('border')).toBe(false);
		});

		it('child input removes focus outline in grouped mode', async () => {
			const screen = render(InputGroupTextInput);

			const input = screen.container.querySelector('input');
			// In grouped mode, TextInput uses 'focus:outline-none' instead of 'focus-visible:outline-2'
			const classes = input?.className ?? '';
			expect(classes).toContain('focus:outline-none');
		});
	});

	describe('disabled state', () => {
		it('applies disabled styling when disabled', async () => {
			const screen = render(InputGroupTextInput, { disabled: true });

			const wrapper = screen.container.querySelector('.opacity-50');
			expect(wrapper).not.toBeNull();
		});
	});
});
