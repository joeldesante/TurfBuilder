import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import JoinOrg from './JoinOrg.svelte';

describe('JoinOrg', () => {
	it('tells the user to ask their organizer for an invite link', async () => {
		render(JoinOrg);
		await expect.element(page.getByText('Ask your organizer for an invite link.')).toBeVisible();
	});

	it('disables text selection on the message', async () => {
		render(JoinOrg);
		const message = page.getByText('Ask your organizer for an invite link.');
		await expect.element(message).toBeVisible();
		expect(message.element().classList.contains('select-none')).toBe(true);
	});

	it('has a back button that returns to the organization page', async () => {
		render(JoinOrg);
		const back = page.getByRole('link', { name: 'Back' });
		await expect.element(back).toBeVisible();
		expect(back.element().getAttribute('href')).toBe('/orgs');
	});

	it('can send the back button somewhere else', async () => {
		render(JoinOrg, { backHref: '/somewhere' });
		const back = page.getByRole('link', { name: 'Back' });
		await expect.element(back).toBeVisible();
		expect(back.element().getAttribute('href')).toBe('/somewhere');
	});

	it('pins the back button to the top left, in a row with the account menu', async () => {
		const { container } = render(JoinOrg, {
			name: 'Alex Rivera',
			email: 'alex@example.com',
			onsignout: vi.fn()
		});
		const row = page.getByRole('link', { name: 'Back' }).element().parentElement!;
		expect(row.classList.contains('absolute')).toBe(true);
		expect(row.classList.contains('top-4')).toBe(true);
		// Tailwind is not loaded in component tests, so check the classes that centre and spread the row.
		expect(row.classList.contains('items-center')).toBe(true);
		expect(row.classList.contains('justify-between')).toBe(true);
		expect(row.contains(page.getByRole('button', { name: 'Account menu' }).element())).toBe(true);
		expect(container.querySelector('.relative')!.contains(row)).toBe(true);
	});

	it('has no account menu without a signed-in user', async () => {
		render(JoinOrg);
		await expect.element(page.getByText('Ask your organizer for an invite link.')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Account menu' }))
			.not.toBeInTheDocument();
	});

	it('offers sign out from the account menu', async () => {
		const onsignout = vi.fn();
		render(JoinOrg, { email: 'alex@example.com', onsignout });
		await page.getByRole('button', { name: 'Account menu' }).click();
		await expect.element(page.getByText('alex@example.com')).toBeVisible();
		await page.getByRole('menuitem', { name: 'Sign Out' }).click();
		expect(onsignout).toHaveBeenCalledTimes(1);
	});
});
