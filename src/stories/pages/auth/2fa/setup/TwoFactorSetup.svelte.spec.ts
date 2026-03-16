import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import TwoFactorSetup from './TwoFactorSetup.svelte';

const data = {
	config: {
		application_name: 'TestApp'
	}
};

describe('TwoFactorSetup', () => {
	describe('step 0 — password entry', () => {
		it('renders the 2FA setup heading with the app name', async () => {
			render(TwoFactorSetup, { data });
			await expect
				.element(page.getByText(/setup Two Factor Authentication/i))
				.toBeVisible();
		});

		it('renders the app name in the heading', async () => {
			render(TwoFactorSetup, { data });
			await expect.element(page.getByText(/TestApp/)).toBeVisible();
		});

		it('renders the password field', async () => {
			render(TwoFactorSetup, { data });
			await expect.element(page.getByLabelText(/password/i)).toBeVisible();
		});

		it('renders the Authorize button', async () => {
			render(TwoFactorSetup, { data });
			await expect.element(page.getByRole('button', { name: 'Authorize' })).toBeVisible();
		});
	});
});
