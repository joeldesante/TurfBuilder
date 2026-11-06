import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import VerifyEmail from './VerifyEmail.svelte';

describe('VerifyEmail', () => {
	it('renders the Verify your email heading', async () => {
		render(VerifyEmail, { props: { email: 'test@example.com' } });
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Verify your email');
	});

	it('renders the user email address', async () => {
		render(VerifyEmail, { props: { email: 'test@example.com' } });
		await expect.element(page.getByText('test@example.com')).toBeVisible();
	});

	it('renders the resend verification email button', async () => {
		render(VerifyEmail, { props: { email: 'test@example.com' } });
		await expect.element(page.getByRole('button', { name: 'Resend verification email' })).toBeVisible();
	});

	it('has a back button to the organizations page', async () => {
		render(VerifyEmail, { props: { email: 'test@example.com' } });
		const back = page.getByRole('link', { name: 'Organizations' });
		await expect.element(back).toBeVisible();
		expect(back.element().getAttribute('href')).toBe('/orgs');
	});

	it('hands a plain click on the back button to onBack instead of following the link', async () => {
		const onBack = vi.fn();
		render(VerifyEmail, { props: { email: 'test@example.com', onBack } });
		const back = page.getByRole('link', { name: 'Organizations' });
		const click = new MouseEvent('click', { bubbles: true, cancelable: true });
		back.element().dispatchEvent(click);
		expect(onBack).toHaveBeenCalledTimes(1);
		expect(click.defaultPrevented).toBe(true);
	});

	it('leaves a modified click on the back button to the browser', async () => {
		const onBack = vi.fn();
		render(VerifyEmail, { props: { email: 'test@example.com', onBack } });
		const back = page.getByRole('link', { name: 'Organizations' });
		const click = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
		back.element().addEventListener('click', (e) => e.preventDefault(), { once: true });
		back.element().dispatchEvent(click);
		expect(onBack).not.toHaveBeenCalled();
	});
});
