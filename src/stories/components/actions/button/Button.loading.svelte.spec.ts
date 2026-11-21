import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
// The real stylesheet, so the button has the size it has in the app.
import '/src/app.css';
import ButtonWithIcon from '$components/__tests__/ButtonWithIcon.svelte';

const size = (el: Element) => {
	const box = el.getBoundingClientRect();
	return { width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10 };
};

describe('Button while loading', () => {
	it('shows the spinner in place of the icon on an icon-only button', async () => {
		const { container } = render(ButtonWithIcon, { props: { iconOnly: true, loading: true } });

		await expect
			.element(page.getByRole('button', { name: 'Remove' }))
			.toHaveAttribute('aria-busy', 'true');
		expect(container.querySelectorAll('button svg')).toHaveLength(1);
		expect(container.querySelector('button svg')?.classList.contains('animate-spin')).toBe(true);
		expect(container.querySelector('[data-testid="the-icon"]')).toBeNull();
	});

	it('shows the icon, and no spinner, when an icon-only button is not loading', async () => {
		const { container } = render(ButtonWithIcon, { props: { iconOnly: true, loading: false } });

		await expect.element(page.getByRole('button', { name: 'Remove' })).toBeVisible();
		expect(container.querySelectorAll('button svg')).toHaveLength(1);
		expect(container.querySelector('[data-testid="the-icon"]')).not.toBeNull();
		expect(container.querySelector('.animate-spin')).toBeNull();
	});

	it.each(['default', 'sm'] as const)(
		'keeps an icon-only %s button the same size whether it is loading or not',
		async (buttonSize) => {
			const idle = render(ButtonWithIcon, {
				props: { iconOnly: true, loading: false, size: buttonSize }
			});
			const before = size(idle.container.querySelector('button')!);
			idle.unmount();

			const busy = render(ButtonWithIcon, {
				props: { iconOnly: true, loading: true, size: buttonSize }
			});
			const during = size(busy.container.querySelector('button')!);

			expect(during).toEqual(before);
		}
	);

	it('keeps the label beside the spinner on a button with words', async () => {
		const { container } = render(ButtonWithIcon, { props: { iconOnly: false, loading: true } });

		await expect.element(page.getByRole('button', { name: 'Remove' })).toHaveTextContent('Remove');
		expect(container.querySelector('.animate-spin')).not.toBeNull();
	});
});
