import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import QrCodeDialog from './QrCodeDialog.svelte';

const props = {
	open: true,
	value: 'https://example.com/invite/abc',
	title: 'Invite link QR code',
	filename: 'invite-link-qr.png',
	onClose: () => {}
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('QrCodeDialog', () => {
	it('shows nothing while closed', async () => {
		render(QrCodeDialog, { props: { ...props, open: false } });
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('shows the title and a QR code image for the value', async () => {
		render(QrCodeDialog, { props });
		await expect.element(page.getByRole('dialog').getByText('Invite link QR code')).toBeVisible();
		const image = page.getByRole('img', { name: 'QR code for https://example.com/invite/abc' });
		await expect.element(image).toBeVisible();
		await expect.element(image).toHaveAttribute('src', expect.stringMatching(/^data:image\/png/));
	});

	it('downloads the code as a PNG under the given name', async () => {
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		render(QrCodeDialog, { props });
		await expect.element(page.getByRole('img')).toBeVisible();

		await page.getByRole('button', { name: 'Download PNG' }).click();

		expect(click).toHaveBeenCalledTimes(1);
		const link = click.mock.contexts[0] as HTMLAnchorElement;
		expect(link.download).toBe('invite-link-qr.png');
		expect(link.href).toMatch(/^data:image\/png/);
	});

	it('does not download before the code is ready', async () => {
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		render(QrCodeDialog, { props: { ...props, value: '' } });

		await page.getByRole('button', { name: 'Download PNG' }).click();

		expect(click).not.toHaveBeenCalled();
	});

	it('calls onClose from the Close button', async () => {
		const onClose = vi.fn();
		render(QrCodeDialog, { props: { ...props, onClose } });
		await page.getByRole('button', { name: 'Close' }).click();
		expect(onClose).toHaveBeenCalled();
	});
});
