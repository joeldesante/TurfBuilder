import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import JoinTurf from './JoinTurf.svelte';

describe('JoinTurf', () => {
	it('renders the heading and description', async () => {
		render(JoinTurf, { onJoin: vi.fn() });
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Join a Turf');
		await expect
			.element(page.getByText('Enter your 6-character turf code to begin canvassing.'))
			.toBeVisible();
	});

	// The code is a six-cell pin input that joins as soon as it is complete;
	// there is no separate Join button. Typing goes to its one hidden input.
	function codeInput(container: HTMLElement) {
		return page.elementLocator(container.querySelector('[data-pin-input-input]')!);
	}

	it('renders six code cells', async () => {
		const { container } = render(JoinTurf, { onJoin: vi.fn() });
		await expect.element(codeInput(container)).toBeInTheDocument();
		expect(container.querySelectorAll('[data-pin-input-cell]')).toHaveLength(6);
	});

	it('joins with the uppercased code once all six characters are entered', async () => {
		const onJoin = vi.fn().mockResolvedValue(undefined);
		const { container } = render(JoinTurf, { onJoin });

		await codeInput(container).fill('ab12cd');

		await vi.waitFor(() => expect(onJoin).toHaveBeenCalledWith('AB12CD'));
	});

	it('does not join before the code is complete', async () => {
		const onJoin = vi.fn().mockResolvedValue(undefined);
		const { container } = render(JoinTurf, { onJoin });

		await codeInput(container).fill('ab1');

		expect(onJoin).not.toHaveBeenCalled();
	});

	it('shows the reason when joining fails', async () => {
		const onJoin = vi.fn().mockRejectedValue(new Error('Turf not found.'));
		const { container } = render(JoinTurf, { onJoin });

		await codeInput(container).fill('zz9999');

		await expect.element(page.getByText('Turf not found.')).toBeVisible();
	});
});
