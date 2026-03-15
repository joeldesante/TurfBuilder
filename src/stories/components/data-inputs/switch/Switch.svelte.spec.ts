import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Switch from './Switch.svelte';
import { createChildrenSnippet, createFormFieldContext } from '../../__tests__/test-utils';

describe('Switch', () => {
	describe('rendering', () => {
		it('renders switch with label when children snippet provided', async () => {
			const screen = render(Switch, {
				children: createChildrenSnippet('Enable notifications')
			});

			const toggle = screen.getByRole('switch');
			await expect.element(toggle).toBeVisible();

			const label = screen.getByText('Enable notifications');
			await expect.element(label).toBeVisible();
		});

		it('renders switch without label when no children', async () => {
			const screen = render(Switch);

			const toggle = screen.getByRole('switch');
			await expect.element(toggle).toBeVisible();

			const labels = screen.container.querySelectorAll('label');
			expect(labels.length).toBe(0);
		});
	});

	describe('states', () => {
		it('defaults to unchecked', async () => {
			const screen = render(Switch);

			const toggle = screen.getByRole('switch');
			expect(toggle.element().getAttribute('data-state')).toBe('unchecked');
		});

		it('shows checked state when checked prop is true', async () => {
			const screen = render(Switch, { checked: true });

			const toggle = screen.getByRole('switch');
			expect(toggle.element().getAttribute('data-state')).toBe('checked');
		});
	});

	describe('interaction', () => {
		it('toggles to checked when clicked', async () => {
			const screen = render(Switch);

			const toggle = screen.getByRole('switch');
			expect(toggle.element().getAttribute('data-state')).toBe('unchecked');
			await toggle.click();
			expect(toggle.element().getAttribute('data-state')).toBe('checked');
		});

		it('toggles back to unchecked on second click', async () => {
			const screen = render(Switch);

			const toggle = screen.getByRole('switch');
			await toggle.click();
			expect(toggle.element().getAttribute('data-state')).toBe('checked');
			await toggle.click();
			expect(toggle.element().getAttribute('data-state')).toBe('unchecked');
		});
	});

	describe('thumb appearance', () => {
		it('thumb always has a light background class regardless of theme', async () => {
			const screen = render(Switch);

			const thumb = screen.container.querySelector('[data-state]')?.querySelector('span');
			expect(thumb).toBeTruthy();
			expect(thumb!.classList.contains('bg-white')).toBe(true);
			expect(thumb!.classList.contains('dark:bg-on-surface')).toBe(false);
		});
	});

	describe('FormField context integration', () => {
		it('sets aria-invalid from context', async () => {
			const screen = render(Switch, {
				props: {},
				context: createFormFieldContext({ invalid: true })
			});

			const toggle = screen.getByRole('switch');
			await expect.element(toggle).toHaveAttribute('aria-invalid', 'true');
		});

		it('disables from context', async () => {
			const screen = render(Switch, {
				props: {},
				context: createFormFieldContext({ disabled: true })
			});

			const toggle = screen.getByRole('switch');
			await expect.element(toggle).toHaveAttribute('disabled');
		});

		it('sets aria-describedby from context', async () => {
			const screen = render(Switch, {
				props: {},
				context: createFormFieldContext({ describedBy: 'helper-1' })
			});

			const toggle = screen.getByRole('switch');
			await expect.element(toggle).toHaveAttribute('aria-describedby', 'helper-1');
		});
	});
});
