import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Badge from './Badge.svelte';
import { createChildrenSnippet } from '../../__tests__/test-utils';

describe('Badge', () => {
	it('renders children text content', async () => {
		const screen = render(Badge, {
			children: createChildrenSnippet('New')
		});

		const badge = screen.getByText('New');
		await expect.element(badge).toBeVisible();
	});

	it('applies default variant classes', async () => {
		const screen = render(Badge, {
			children: createChildrenSnippet('Default')
		});

		// getByText returns the inner snippet span; parentElement is the Badge <span>
		const text = screen.getByText('Default');
		const badge = text.element().parentElement;
		expect(badge?.classList.contains('bg-surface-container')).toBe(true);
	});

	it('applies error variant classes', async () => {
		const screen = render(Badge, {
			children: createChildrenSnippet('Error'),
			variant: 'error'
		});

		const text = screen.getByText('Error');
		const badge = text.element().parentElement;
		expect(badge?.classList.contains('bg-error-container')).toBe(true);
	});

	it('applies sm size classes', async () => {
		const screen = render(Badge, {
			children: createChildrenSnippet('Small'),
			size: 'sm'
		});

		const text = screen.getByText('Small');
		const badge = text.element().parentElement;
		expect(badge?.classList.contains('text-xs')).toBe(true);
	});
});
