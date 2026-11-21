import { describe, it, expect, vi, beforeEach } from 'vitest';

const { goto } = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto }));

import { LOGO_AT_ONCE, navigateWithLoader } from './navigate-with-loader';
import { pageLoader } from './page-loader.svelte';

beforeEach(() => {
	vi.clearAllMocks();
	pageLoader.hide();
});

describe('navigateWithLoader', () => {
	it('raises the loader, then navigates with the options given, leaving the loader for the layout', async () => {
		goto.mockImplementation(async () => {
			expect(pageLoader.active).toBe(true);
		});

		await navigateWithLoader('/o/acme/s?bucket=voters', { noScroll: true });

		expect(goto).toHaveBeenCalledWith('/o/acme/s?bucket=voters', { noScroll: true });
		expect(pageLoader.active).toBe(true);
	});

	it('puts the loader away and rethrows when the navigation fails', async () => {
		goto.mockRejectedValue(new Error('offline'));

		await expect(navigateWithLoader('/x')).rejects.toThrow('offline');
		expect(pageLoader.active).toBe(false);
	});

	it('fades before showing the logo by default, and shows it at once with LOGO_AT_ONCE', async () => {
		goto.mockResolvedValue(undefined);

		await navigateWithLoader('/x');
		expect(pageLoader.logoDelayMs).toBe(450);

		await navigateWithLoader('/x', {}, LOGO_AT_ONCE);
		expect(pageLoader.logoDelayMs).toBe(0);
		expect(pageLoader.logoMinMs).toBe(700);
	});
});
