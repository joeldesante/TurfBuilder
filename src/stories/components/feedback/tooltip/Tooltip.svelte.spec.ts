import { render } from 'vitest-browser-svelte';
import { page, userEvent } from '@vitest/browser/context';
import { expect, test } from 'vitest';
import { vi } from 'vitest';
import Tooltip from './Tooltip.svelte';
import TooltipOnButton from '$components/__tests__/TooltipOnButton.svelte';

test('mounts closed: the trigger is there, the tooltip text is not', async () => {
	const { getByRole, getByText } = render(Tooltip, {
		props: { text: 'Tooltip message', children: undefined as never }
	});
	await expect.element(getByRole('button')).toHaveAttribute('data-state', 'closed');
	// The content is only rendered (in a portal) while the tooltip is open.
	await expect.element(getByText('Tooltip message')).not.toBeInTheDocument();
});

test('can be put on a button itself, without nesting one button inside another', async () => {
	const { container } = render(TooltipOnButton);
	await expect.element(page.getByRole('button', { name: 'Archive thing' })).toBeVisible();

	expect(container.querySelectorAll('button')).toHaveLength(1);
	expect(container.querySelector('button button')).toBeNull();
});

test('opens its text when the pointer rests on a button trigger', async () => {
	render(TooltipOnButton);
	const button = page.getByRole('button', { name: 'Archive thing' });
	await expect.element(button).toHaveAttribute('data-state', 'closed');

	await button.hover();

	await expect.element(page.getByText('Archive', { exact: true })).toBeVisible();
	await expect.element(button).not.toHaveAttribute('data-state', 'closed');
});

test('opens its text when a button trigger is focused from the keyboard', async () => {
	render(TooltipOnButton);

	await userEvent.tab();

	await expect.element(page.getByText('Archive', { exact: true })).toBeVisible();
});

test("still runs the button's own click", async () => {
	const onclick = vi.fn();
	render(TooltipOnButton, { props: { onclick } });

	await page.getByRole('button', { name: 'Archive thing' }).click();

	expect(onclick).toHaveBeenCalledTimes(1);
});
