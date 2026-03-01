import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Button from './Button.svelte';
import { createChildrenSnippet } from '../../__tests__/test-utils';

describe('Button', () => {
	describe('rendering', () => {
		it('renders as a <button> with children content', async () => {
			const screen = render(Button, {
				children: createChildrenSnippet('Save changes')
			});

			const button = screen.getByRole('button', { name: 'Save changes' });
			await expect.element(button).toBeVisible();
			await expect.element(button).toHaveTextContent('Save changes');
		});

		it('renders as an <a> element when href is provided', async () => {
			const screen = render(Button, {
				children: createChildrenSnippet('Visit'),
				href: '/about'
			});

			const link = screen.getByRole('link', { name: 'Visit' });
			await expect.element(link).toBeVisible();
			await expect.element(link).toHaveAttribute('href', '/about');
		});

		it('renders as a <button> when href is provided but disabled', async () => {
			const screen = render(Button, {
				children: createChildrenSnippet('Disabled Link'),
				href: '/about',
				disabled: true
			});

			const button = screen.getByRole('button', { name: 'Disabled Link' });
			await expect.element(button).toBeVisible();
		});
	});

	describe('variants', () => {
		it('applies primary variant classes by default', async () => {
			const screen = render(Button, {
				children: createChildrenSnippet('Primary')
			});

			const button = screen.getByRole('button');
			await expect.element(button).toHaveClass('bg-primary');
		});

		it('applies destructive variant classes', async () => {
			const screen = render(Button, {
				children: createChildrenSnippet('Delete'),
				variant: 'destructive'
			});

			const button = screen.getByRole('button');
			await expect.element(button).toHaveClass('bg-error');
		});
	});

	describe('loading state', () => {
		it('sets aria-busy="true" when loading', async () => {
			const screen = render(Button, {
				children: createChildrenSnippet('Saving...'),
				loading: true
			});

			const button = screen.getByRole('button', { name: 'Saving...' });
			await expect.element(button).toHaveAttribute('aria-busy', 'true');
		});

		it('sets aria-disabled="true" when loading', async () => {
			const screen = render(Button, {
				children: createChildrenSnippet('Saving...'),
				loading: true
			});

			const button = screen.getByRole('button', { name: 'Saving...' });
			await expect.element(button).toHaveAttribute('aria-disabled', 'true');
		});

		it('applies pointer-events-none when loading', async () => {
			const screen = render(Button, {
				children: createChildrenSnippet('Submit'),
				loading: true
			});

			const button = screen.getByRole('button');
			await expect.element(button).toHaveClass('pointer-events-none');
		});
	});

	describe('disabled state', () => {
		it('sets the disabled attribute on the button element', async () => {
			const screen = render(Button, {
				children: createChildrenSnippet('Disabled'),
				disabled: true
			});

			const button = screen.getByRole('button', { name: 'Disabled' });
			await expect.element(button).toHaveAttribute('disabled');
		});
	});

	describe('icon-only mode', () => {
		it('applies aria-label to the button when iconOnly', async () => {
			const screen = render(Button, {
				children: createChildrenSnippet('X'),
				iconOnly: true,
				'aria-label': 'Close dialog'
			});

			const button = screen.getByRole('button', { name: 'Close dialog' });
			await expect.element(button).toBeVisible();
		});
	});
});
