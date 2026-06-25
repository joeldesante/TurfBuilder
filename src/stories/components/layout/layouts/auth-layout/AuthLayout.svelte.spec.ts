import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import AuthLayout from './AuthLayout.svelte';

describe('AuthLayout', () => {
	it('renders the logo', async () => {
		const children = createRawSnippet(() => ({ render: () => `<p>content</p>` }));
		const screen = render(AuthLayout, { children });
		await expect.element(screen.getByRole('img', { name: 'Logo' })).toBeVisible();
	});

	it('renders children content', async () => {
		const children = createRawSnippet(() => ({
			render: () => `<p data-testid="inner">Hello</p>`
		}));
		const screen = render(AuthLayout, { children });
		await expect.element(screen.getByText('Hello')).toBeVisible();
	});

	it('renders footer when provided', async () => {
		const children = createRawSnippet(() => ({ render: () => `<p>content</p>` }));
		const footer = createRawSnippet(() => ({
			render: () => `<a href="/auth/signup">Sign up</a>`
		}));
		const screen = render(AuthLayout, { children, footer });
		await expect.element(screen.getByRole('link', { name: 'Sign up' })).toBeVisible();
	});

	it('does not render footer container when footer is omitted', async () => {
		const children = createRawSnippet(() => ({ render: () => `<p>content</p>` }));
		const screen = render(AuthLayout, { children });
		const link = screen.container.querySelector('a');
		expect(link).toBeNull();
	});
});
