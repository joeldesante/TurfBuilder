import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import UserMenu from './UserMenu.svelte';

describe('UserMenu', () => {
	it('shows only the account button until it is pressed', async () => {
		render(UserMenu, { email: 'alex@example.com', onsignout: vi.fn() });
		await expect.element(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
		await expect.element(page.getByText('alex@example.com')).not.toBeInTheDocument();
		await expect.element(page.getByText('Sign Out')).not.toBeInTheDocument();
	});

	it('shows the email and a sign out action when opened', async () => {
		render(UserMenu, { email: 'alex@example.com', onsignout: vi.fn() });
		await page.getByRole('button', { name: 'Account menu' }).click();
		await expect.element(page.getByText('alex@example.com')).toBeVisible();
		await expect.element(page.getByRole('menuitem', { name: 'Sign Out' })).toBeVisible();
	});

	it('calls onsignout when Sign Out is chosen', async () => {
		const onsignout = vi.fn();
		render(UserMenu, { email: 'alex@example.com', onsignout });
		await page.getByRole('button', { name: 'Account menu' }).click();
		await page.getByRole('menuitem', { name: 'Sign Out' }).click();
		expect(onsignout).toHaveBeenCalledTimes(1);
	});

	it('shows the first letters of the name in the avatar', async () => {
		render(UserMenu, { name: 'Alex Rivera', email: 'alex@example.com', onsignout: vi.fn() });
		await expect.element(page.getByRole('img', { name: 'Alex Rivera' })).toHaveTextContent('Al');
	});

	it('falls back to the email when there is no name', async () => {
		render(UserMenu, { email: 'zed@example.com', onsignout: vi.fn() });
		await expect.element(page.getByRole('img', { name: 'zed@example.com' })).toHaveTextContent('Ze');
	});
});
