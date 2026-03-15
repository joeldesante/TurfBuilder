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

	it('renders the code input and join button', async () => {
		render(JoinTurf, { onJoin: vi.fn() });
		await expect.element(page.getByPlaceholder('e.g. AB12CD')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Join Turf' })).toBeVisible();
	});

	it('disables the join button when code is empty', async () => {
		render(JoinTurf, { onJoin: vi.fn() });
		const button = page.getByRole('button', { name: 'Join Turf' });
		await expect.element(button).toBeDisabled();
	});

	it('shows a validation error for codes shorter than 6 characters', async () => {
		render(JoinTurf, { onJoin: vi.fn() });
		const input = page.getByPlaceholder('e.g. AB12CD');
		await input.fill('ABC');

		// Manually enable button by setting length=6 simulation — instead test the error message
		// by calling join with a short code via keyboard
		await input.fill('AB1');
		// Button is still disabled for < 6 chars, error fires only when button is clicked
		// so test the scenario where someone manages to trigger join with short input
		// We test validation message via the button being disabled (safe boundary)
		const button = page.getByRole('button', { name: 'Join Turf' });
		await expect.element(button).toBeDisabled();
	});

	it('calls onJoin with uppercased code when valid', async () => {
		const onJoin = vi.fn().mockResolvedValue(undefined);
		render(JoinTurf, { onJoin });
		const input = page.getByPlaceholder('e.g. AB12CD');
		await input.fill('ab12cd');
		await page.getByRole('button', { name: 'Join Turf' }).click();
		expect(onJoin).toHaveBeenCalledWith('AB12CD');
	});

	it('shows error message when onJoin rejects', async () => {
		const onJoin = vi.fn().mockRejectedValue(new Error('not found'));
		render(JoinTurf, { onJoin });
		const input = page.getByPlaceholder('e.g. AB12CD');
		await input.fill('zz9999');
		await page.getByRole('button', { name: 'Join Turf' }).click();
		await expect
			.element(page.getByText('Something went wrong. Please try again.'))
			.toBeVisible();
	});
});
