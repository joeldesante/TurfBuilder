import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import ScanStep from './ScanStep.svelte';

describe('ScanStep', () => {
	const totpUri = 'otpauth://totp/TestApp:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=TestApp';

	it('renders a QR code canvas', async () => {
		const { container } = render(ScanStep, { totpUri, onNext: vi.fn() });
		const canvas = container.querySelector('canvas');
		expect(canvas).toBeTruthy();
	});

	it('renders the Next button', async () => {
		render(ScanStep, { totpUri, onNext: vi.fn() });
		await expect.element(page.getByRole('button', { name: 'Next' })).toBeVisible();
	});

	it('renders the DUO Mobile link', async () => {
		render(ScanStep, { totpUri, onNext: vi.fn() });
		await expect.element(page.getByRole('link', { name: /DUO Mobile/i })).toBeVisible();
	});

	it('renders the manual-add link with the totpUri as href', async () => {
		render(ScanStep, { totpUri, onNext: vi.fn() });
		const link = page.getByRole('link', { name: /add this account/i });
		await expect.element(link).toBeVisible();
		expect(link.element().getAttribute('href')).toBe(totpUri);
	});

	it('calls onNext when the Next button is clicked', async () => {
		const onNext = vi.fn();
		render(ScanStep, { totpUri, onNext });
		await page.getByRole('button', { name: 'Next' }).click();
		expect(onNext).toHaveBeenCalled();
	});
});
