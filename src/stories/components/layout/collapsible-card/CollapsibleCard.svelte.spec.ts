import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CollapsibleCard from './CollapsibleCard.svelte';
import { createChildrenSnippet } from '../../__tests__/test-utils';

describe('CollapsibleCard', () => {
	it('shows the title and body when open', async () => {
		const screen = render(CollapsibleCard, {
			title: 'Our Values',
			children: createChildrenSnippet('Body text')
		});

		await expect.element(screen.getByRole('button', { name: 'Our Values' })).toBeVisible();
		await expect.element(screen.getByText('Body text')).toBeVisible();
	});

	it('starts closed when open is false', async () => {
		const screen = render(CollapsibleCard, {
			title: 'Our Values',
			open: false,
			children: createChildrenSnippet('Body text')
		});

		await expect
			.element(screen.getByRole('button', { name: 'Our Values' }))
			.toHaveAttribute('aria-expanded', 'false');
		await expect.element(screen.getByText('Body text')).not.toBeInTheDocument();
	});

	it('hides and shows the body when the heading is clicked', async () => {
		const screen = render(CollapsibleCard, {
			title: 'Our Values',
			children: createChildrenSnippet('Body text')
		});
		const toggle = screen.getByRole('button', { name: 'Our Values' });

		await toggle.click();
		await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect.element(screen.getByText('Body text')).not.toBeInTheDocument();

		await toggle.click();
		await expect.element(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect.element(screen.getByText('Body text')).toBeVisible();
	});

	it('points the button at the body it controls', async () => {
		const screen = render(CollapsibleCard, {
			title: 'Our Values',
			children: createChildrenSnippet('Body text')
		});

		const controls = screen
			.getByRole('button', { name: 'Our Values' })
			.element()
			.getAttribute('aria-controls');
		expect(controls).toBeTruthy();
		expect(document.getElementById(controls!)).not.toBeNull();
	});
});
