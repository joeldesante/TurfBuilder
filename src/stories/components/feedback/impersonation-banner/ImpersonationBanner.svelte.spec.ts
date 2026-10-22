import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import ImpersonationBanner from './ImpersonationBanner.svelte';

test('says who is being impersonated', async () => {
	const { getByRole } = render(ImpersonationBanner, { props: { userName: 'Alan Turing', onstop: vi.fn() } });

	await expect.element(getByRole('status')).toHaveTextContent('You are signed in as Alan Turing');
});

test('stops when asked', async () => {
	const onstop = vi.fn(async () => {});
	const { getByRole } = render(ImpersonationBanner, { props: { userName: 'Alan', onstop } });

	await getByRole('button', { name: 'Stop impersonating' }).click();
	expect(onstop).toHaveBeenCalledOnce();
});

test('shows why stopping failed', async () => {
	const onstop = vi.fn(async () => {
		throw new Error('Sign out and sign in again.');
	});
	const { getByRole, getByText } = render(ImpersonationBanner, { props: { userName: 'Alan', onstop } });

	await getByRole('button', { name: 'Stop impersonating' }).click();
	await expect.element(getByText('Sign out and sign in again.')).toBeVisible();
});
