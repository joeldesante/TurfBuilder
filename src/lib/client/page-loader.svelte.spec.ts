import { describe, it, expect, beforeEach } from 'vitest';
import { pageLoader } from './page-loader.svelte';

describe('pageLoader', () => {
	beforeEach(() => pageLoader.hide());

	it('starts hidden', () => {
		expect(pageLoader.active).toBe(false);
	});

	it('shows and hides', () => {
		pageLoader.show();
		expect(pageLoader.active).toBe(true);

		pageLoader.hide();
		expect(pageLoader.active).toBe(false);
	});

	it('is harmless to show twice or hide twice', () => {
		pageLoader.show();
		pageLoader.show();
		expect(pageLoader.active).toBe(true);

		pageLoader.hide();
		pageLoader.hide();
		expect(pageLoader.active).toBe(false);
	});

	it('shows the logo straight away unless a delay is asked for', () => {
		pageLoader.show();
		expect(pageLoader.logoDelayMs).toBe(0);
	});

	it('holds the logo back by the delay it was shown with', () => {
		pageLoader.show({ logoDelayMs: 1000 });
		expect(pageLoader.logoDelayMs).toBe(1000);
	});

	it("does not carry one use's delay into the next", () => {
		pageLoader.show({ logoDelayMs: 1000 });
		pageLoader.hide();
		pageLoader.show();
		expect(pageLoader.logoDelayMs).toBe(0);
	});

	it('keeps the delay after hide so a visible logo is not dropped while the cover fades out', () => {
		pageLoader.show({ logoDelayMs: 1000 });
		pageLoader.hide();
		expect(pageLoader.logoDelayMs).toBe(1000);
	});

	it('has no minimum logo time unless one is asked for', () => {
		pageLoader.show();
		expect(pageLoader.logoMinMs).toBe(0);
	});

	it('keeps the logo up for at least the minimum it was shown with', () => {
		pageLoader.show({ logoDelayMs: 1000, logoMinMs: 1000 });
		expect(pageLoader.logoMinMs).toBe(1000);
	});

	it("does not carry one use's minimum into the next", () => {
		pageLoader.show({ logoMinMs: 1000 });
		pageLoader.hide();
		pageLoader.show();
		expect(pageLoader.logoMinMs).toBe(0);
	});

	it('has no slow message unless one is asked for', () => {
		pageLoader.show();
		expect(pageLoader.slowMessageDelayMs).toBe(0);
	});

	it('shows the slow message after the delay it was shown with', () => {
		pageLoader.show({ slowMessageDelayMs: 10000 });
		expect(pageLoader.slowMessageDelayMs).toBe(10000);
	});

	it("does not carry one use's slow message into the next", () => {
		pageLoader.show({ slowMessageDelayMs: 10000 });
		pageLoader.hide();
		pageLoader.show();
		expect(pageLoader.slowMessageDelayMs).toBe(0);
	});
});
