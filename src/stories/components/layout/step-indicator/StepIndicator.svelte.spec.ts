import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StepIndicator from './StepIndicator.svelte';

const steps = ['Kind', 'Description', 'Name'];

describe('StepIndicator', () => {
	it('shows the position and the current step title', async () => {
		const screen = render(StepIndicator, { steps, current: 1 });

		await expect.element(screen.getByText('Step 2 of 3')).toBeVisible();
		await expect
			.element(screen.getByRole('heading', { level: 2 }))
			.toHaveTextContent('Description');
	});

	it('marks only the current step in the progress list', async () => {
		const screen = render(StepIndicator, { steps, current: 2 });

		const items = screen.getByRole('listitem').elements();
		expect(items).toHaveLength(3);
		expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([null, null, 'step']);
	});

	it('fills the bars up to the current step', async () => {
		const screen = render(StepIndicator, { steps, current: 1 });

		const items = screen.getByRole('listitem').elements();
		expect(items.map((item) => item.classList.contains('bg-primary'))).toEqual([true, true, false]);
	});

	it('lets the heading take focus', async () => {
		const screen = render(StepIndicator, { steps, current: 0 });
		const heading = screen.getByRole('heading', { level: 2 });

		heading.element().focus();

		await expect.element(heading).toHaveFocus();
	});
});
