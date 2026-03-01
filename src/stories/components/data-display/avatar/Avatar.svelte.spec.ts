import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Avatar from './Avatar.svelte';

describe('Avatar', () => {
	describe('rendering', () => {
		it('renders with role="img" and aria-label set to the username', async () => {
			const screen = render(Avatar, { username: 'Sabina' });
			const avatar = screen.getByRole('img', { name: 'Sabina' });
			await expect.element(avatar).toBeVisible();
		});

		it('displays the first two characters as initials', async () => {
			const screen = render(Avatar, { username: 'Sabina' });
			const avatar = screen.getByRole('img', { name: 'Sabina' });
			await expect.element(avatar).toHaveTextContent('Sa');
		});

		it('trims whitespace before extracting initials', async () => {
			const screen = render(Avatar, { username: '  Jo' });
			const avatar = screen.getByRole('img', { name: 'Jo' });
			await expect.element(avatar).toHaveTextContent('Jo');
		});

		it('handles single-character usernames', async () => {
			const screen = render(Avatar, { username: 'A' });
			const avatar = screen.getByRole('img', { name: 'A' });
			await expect.element(avatar).toHaveTextContent('A');
		});
	});

	describe('sizes', () => {
		it('applies sm size classes', async () => {
			const screen = render(Avatar, { username: 'AB', size: 'sm' });
			const avatar = screen.getByRole('img').element();
			expect(avatar.classList.contains('size-8')).toBe(true);
			expect(avatar.classList.contains('text-xs')).toBe(true);
		});

		it('applies md size classes by default', async () => {
			const screen = render(Avatar, { username: 'AB' });
			const avatar = screen.getByRole('img').element();
			expect(avatar.classList.contains('size-10')).toBe(true);
			expect(avatar.classList.contains('text-sm')).toBe(true);
		});

		it('applies lg size classes', async () => {
			const screen = render(Avatar, { username: 'AB', size: 'lg' });
			const avatar = screen.getByRole('img').element();
			expect(avatar.classList.contains('size-12')).toBe(true);
			expect(avatar.classList.contains('text-base')).toBe(true);
		});
	});

	describe('variants', () => {
		it('applies default variant classes by default', async () => {
			const screen = render(Avatar, { username: 'AB' });
			const avatar = screen.getByRole('img').element();
			expect(avatar.classList.contains('bg-surface-container-high')).toBe(true);
		});

		it('applies primary variant classes', async () => {
			const screen = render(Avatar, { username: 'AB', variant: 'primary' });
			const avatar = screen.getByRole('img').element();
			expect(avatar.classList.contains('bg-primary-container')).toBe(true);
		});
	});
});
