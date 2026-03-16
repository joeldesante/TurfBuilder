import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import VerifyStep from './VerifyStep.svelte';

describe('VerifyStep', () => {
	it('renders the one-time passcode heading', async () => {
		render(VerifyStep, { onVerified: vi.fn(), onBack: vi.fn() });
		await expect
			.element(page.getByText('Enter your one time passcode'))
			.toBeVisible();
	});

	it('renders a PIN input', async () => {
		const { container } = render(VerifyStep, { onVerified: vi.fn(), onBack: vi.fn() });
		// PinInput renders individual character inputs
		const inputs = container.querySelectorAll('input');
		expect(inputs.length).toBeGreaterThan(0);
	});

	it('renders the Back button', async () => {
		render(VerifyStep, { onVerified: vi.fn(), onBack: vi.fn() });
		await expect.element(page.getByRole('button', { name: 'Back' })).toBeVisible();
	});

	it('calls onBack when the Back button is clicked', async () => {
		const onBack = vi.fn();
		render(VerifyStep, { onVerified: vi.fn(), onBack });
		await page.getByRole('button', { name: 'Back' }).click();
		expect(onBack).toHaveBeenCalled();
	});
});
