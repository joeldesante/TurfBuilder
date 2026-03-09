import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CopyButton from './CopyButton.svelte';

describe('CopyButton', () => {
	describe('rendering', () => {
		it('renders a button with the default aria-label', async () => {
			const screen = render(CopyButton, { value: 'hello' });

			const button = screen.getByRole('button', { name: 'Copy to clipboard' });
			await expect.element(button).toBeVisible();
		});

		it('renders a button with a custom aria-label', async () => {
			const screen = render(CopyButton, { value: 'hello', 'aria-label': 'Copy code' });

			const button = screen.getByRole('button', { name: 'Copy code' });
			await expect.element(button).toBeVisible();
		});
	});

	describe('interaction', () => {
		it('calls navigator.clipboard.writeText with the value on click', async () => {
			const writeText = vi.fn().mockResolvedValue(undefined);
			Object.defineProperty(navigator, 'clipboard', {
				value: { writeText },
				configurable: true
			});

			const screen = render(CopyButton, { value: 'copy-me' });
			const button = screen.getByRole('button');
			await button.click();

			expect(writeText).toHaveBeenCalledWith('copy-me');
		});
	});
});
