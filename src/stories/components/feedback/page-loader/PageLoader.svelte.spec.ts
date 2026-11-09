import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import PageLoader from './PageLoader.svelte';

describe('PageLoader', () => {
	it('covers the screen with the loader when visible', async () => {
		const { container } = render(PageLoader, { visible: true });
		await expect.element(page.getByRole('status')).toHaveTextContent('Loading');
		const cover = container.querySelector('.page-loader')!;
		for (const name of ['fixed', 'inset-0', 'z-50', 'bg-surface']) {
			expect(cover.classList.contains(name)).toBe(true);
		}
	});

	it('renders nothing when hidden', async () => {
		const { container } = render(PageLoader, { visible: false });
		await expect.element(page.getByRole('status')).not.toBeInTheDocument();
		expect(container.querySelector('.page-loader')).toBeNull();
	});

	it('fades in', async () => {
		const { container } = render(PageLoader, { visible: true });
		await expect.element(page.getByRole('status')).toBeVisible();
		expect(getComputedStyle(container.querySelector('.page-loader')!).animationName).toContain(
			'page-loader-in'
		);
	});

	it('cuts in without a fade when asked, and still fades out', async () => {
		const screen = render(PageLoader, { visible: true, cutIn: true });
		await expect.element(page.getByRole('status')).toBeVisible();
		const cover = screen.container.querySelector('.page-loader')!;
		expect(getComputedStyle(cover).animationName).toBe('none');
		expect(getComputedStyle(cover).opacity).toBe('1');

		await screen.rerender({ visible: false, cutIn: true });

		expect(screen.container.querySelector('.page-loader')).not.toBeNull();
		await expect.poll(() => screen.container.querySelector('.page-loader')).toBeNull();
	});

	it('fades out instead of vanishing when it is turned off', async () => {
		const screen = render(PageLoader, { visible: true });
		await expect.element(page.getByRole('status')).toBeVisible();

		await screen.rerender({ visible: false });

		// Still in the document while the fade runs, then gone.
		expect(screen.container.querySelector('.page-loader')).not.toBeNull();
		await expect.poll(() => screen.container.querySelector('.page-loader')).toBeNull();
	});

	describe('logo delay', () => {
		const status = () => page.getByRole('status');

		it('is only a plain cover until the delay has passed, then the logo fades in', async () => {
			const { container } = render(PageLoader, { visible: true, logoDelayMs: 300 });

			expect(container.querySelector('.page-loader')).not.toBeNull();
			await expect.element(status()).not.toBeInTheDocument();

			await expect.element(status(), { timeout: 2000 }).toBeVisible();
		});

		it('never shows the logo if the cover goes away before the delay', async () => {
			const screen = render(PageLoader, { visible: true, logoDelayMs: 400 });
			await screen.rerender({ visible: false });

			await expect.poll(() => screen.container.querySelector('.page-loader')).toBeNull();
			await new Promise((resolve) => setTimeout(resolve, 600));

			await expect.element(status()).not.toBeInTheDocument();
		});

		it('keeps the logo on the cover while it fades out', async () => {
			const screen = render(PageLoader, { visible: true, logoDelayMs: 0 });
			await expect.element(status()).toBeVisible();

			await screen.rerender({ visible: false });

			expect(screen.container.querySelector('.page-loader')).not.toBeNull();
			await expect.element(status()).toBeInTheDocument();
			await expect.poll(() => screen.container.querySelector('.page-loader')).toBeNull();
		});

		it('waits again the next time the cover comes up', async () => {
			const screen = render(PageLoader, { visible: true, logoDelayMs: 250 });
			await expect.element(status(), { timeout: 2000 }).toBeVisible();

			await screen.rerender({ visible: false });
			await expect.poll(() => screen.container.querySelector('.page-loader')).toBeNull();
			await screen.rerender({ visible: true });

			expect(screen.container.querySelector('.page-loader')).not.toBeNull();
			await expect.element(status()).not.toBeInTheDocument();
			await expect.element(status(), { timeout: 2000 }).toBeVisible();
		});
	});
	describe('logo minimum time', () => {
		const status = () => page.getByRole('status');
		const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

		it('keeps the cover up until the logo has had its minimum time, even if hidden sooner', async () => {
			const screen = render(PageLoader, { visible: true, logoDelayMs: 100, logoMinMs: 900 });
			await expect.element(status(), { timeout: 2000 }).toBeVisible();
			const shownAt = performance.now();

			await screen.rerender({ visible: false });
			await wait(400);

			// Hidden 400ms ago, but the logo has not had its time yet.
			expect(screen.container.querySelector('.page-loader')).not.toBeNull();
			await expect.element(status()).toBeVisible();

			await expect
				.poll(() => screen.container.querySelector('.page-loader'), { timeout: 3000 })
				.toBeNull();
			expect(performance.now() - shownAt).toBeGreaterThanOrEqual(800);
		});

		it('goes straight away when the logo has already had its time', async () => {
			const screen = render(PageLoader, { visible: true, logoDelayMs: 0, logoMinMs: 150 });
			await expect.element(status()).toBeVisible();
			await wait(300);

			await screen.rerender({ visible: false });

			// Only the fade-out remains.
			await expect
				.poll(() => screen.container.querySelector('.page-loader'), { timeout: 1000 })
				.toBeNull();
		});

		it('does not hold the cover if the logo never appeared', async () => {
			const screen = render(PageLoader, { visible: true, logoDelayMs: 600, logoMinMs: 2000 });
			await screen.rerender({ visible: false });

			await expect
				.poll(() => screen.container.querySelector('.page-loader'), { timeout: 1000 })
				.toBeNull();
			await expect.element(status()).not.toBeInTheDocument();
		});

		it('has no minimum unless one is asked for', async () => {
			const screen = render(PageLoader, { visible: true, logoDelayMs: 0 });
			await expect.element(status()).toBeVisible();

			await screen.rerender({ visible: false });

			await expect
				.poll(() => screen.container.querySelector('.page-loader'), { timeout: 1000 })
				.toBeNull();
		});

		it('shows again right away if it is brought back while being held', async () => {
			const screen = render(PageLoader, { visible: true, logoDelayMs: 0, logoMinMs: 1500 });
			await expect.element(status()).toBeVisible();
			await screen.rerender({ visible: false });

			await screen.rerender({ visible: true });
			await wait(300);

			expect(screen.container.querySelector('.page-loader')).not.toBeNull();
		});
	});
	describe('slow load message', () => {
		const message = () =>
			page.getByText('This is taking a little longer than usual. Thanks for your patience.');
		const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

		it('fades in under the logo once the delay has passed', async () => {
			render(PageLoader, { visible: true, logoDelayMs: 0, slowMessageDelayMs: 400 });
			await expect.element(page.getByRole('status')).toBeVisible();
			await expect.element(message()).not.toBeInTheDocument();

			await expect.element(message(), { timeout: 3000 }).toBeVisible();
			// The logo is still there.
			await expect.element(page.getByRole('status')).toBeVisible();
		});

		it('sits below the logo without pushing it', async () => {
			const { container } = render(PageLoader, {
				visible: true,
				logoDelayMs: 0,
				slowMessageDelayMs: 200
			});
			await expect.element(page.getByRole('status')).toBeVisible();
			const logo = container.querySelector('svg')!;
			const before = logo.getBoundingClientRect().top;

			await expect.element(message(), { timeout: 3000 }).toBeVisible();

			expect(Math.abs(logo.getBoundingClientRect().top - before)).toBeLessThan(1);
			expect(message().element().getBoundingClientRect().top).toBeGreaterThan(
				logo.getBoundingClientRect().bottom - 1
			);
		});

		it('never shows without a delay', async () => {
			render(PageLoader, { visible: true, logoDelayMs: 0 });
			await expect.element(page.getByRole('status')).toBeVisible();
			await wait(500);

			await expect.element(message()).not.toBeInTheDocument();
		});

		it('does not show if the cover goes away first', async () => {
			const screen = render(PageLoader, {
				visible: true,
				logoDelayMs: 0,
				slowMessageDelayMs: 600
			});
			await screen.rerender({ visible: false });
			await expect
				.poll(() => screen.container.querySelector('.page-loader'), { timeout: 1000 })
				.toBeNull();
			await wait(800);

			await expect.element(message()).not.toBeInTheDocument();
		});

		it('waits again the next time the cover comes up', async () => {
			const screen = render(PageLoader, {
				visible: true,
				logoDelayMs: 0,
				slowMessageDelayMs: 300
			});
			await expect.element(message(), { timeout: 3000 }).toBeVisible();
			await screen.rerender({ visible: false });
			await expect
				.poll(() => screen.container.querySelector('.page-loader'), { timeout: 1000 })
				.toBeNull();

			await screen.rerender({ visible: true });

			await expect.element(message()).not.toBeInTheDocument();
			await expect.element(message(), { timeout: 3000 }).toBeVisible();
		});

		it('is stacked on two lines, one sentence each', async () => {
			render(PageLoader, { visible: true, logoDelayMs: 0, slowMessageDelayMs: 200 });
			await expect.element(message(), { timeout: 3000 }).toBeVisible();

			const span = message().element();
			expect(span.textContent).toBe(
				'This is taking a little longer than usual.\nThanks for your patience.'
			);
			// Tailwind's stylesheet is not loaded in component tests, so check the class that turns
			// the line break into a new line.
			expect(span.closest('p')!.classList.contains('whitespace-pre-line')).toBe(true);
		});

		it('has a polite live region so screen readers hear it', async () => {
			const { container } = render(PageLoader, {
				visible: true,
				logoDelayMs: 0,
				slowMessageDelayMs: 200
			});
			await expect.element(page.getByRole('status')).toBeVisible();

			expect(container.querySelector('p[aria-live="polite"]')).not.toBeNull();
		});
	});
});
