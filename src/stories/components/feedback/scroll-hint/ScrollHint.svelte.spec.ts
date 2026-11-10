import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ScrollHint from './ScrollHint.svelte';

let target: HTMLElement | undefined;

// A block far below the fold, so it starts off screen.
function addTarget() {
	target = document.createElement('div');
	target.textContent = 'Far below';
	target.style.cssText = 'position: absolute; top: 4000px; height: 50px;';
	document.body.appendChild(target);
	return target;
}

afterEach(() => {
	target?.remove();
	target = undefined;
	window.scrollTo(0, 0);
});

describe('ScrollHint', () => {
	it('shows nothing without a target', async () => {
		const screen = render(ScrollHint, {});

		await expect.element(screen.getByRole('button')).not.toBeInTheDocument();
	});

	it('shows a button while the target is off screen', async () => {
		const screen = render(ScrollHint, { target: addTarget(), label: 'Scroll to the form' });

		await expect
			.element(screen.getByRole('button', { name: 'Scroll to the form' }))
			.toBeInTheDocument();
	});

	it('stays hidden when turned off', async () => {
		const screen = render(ScrollHint, { target: addTarget(), enabled: false });

		await expect.element(screen.getByRole('button')).not.toBeInTheDocument();
	});

	it('scrolls to the target when clicked, then goes away', async () => {
		const screen = render(ScrollHint, { target: addTarget() });

		await screen.getByRole('button', { name: 'Scroll down' }).click();

		await expect.element(screen.getByRole('button')).not.toBeInTheDocument();
		expect(window.scrollY).toBeGreaterThan(0);
	});
});
