import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import Tooltip from './Tooltip.svelte';

test('mounts closed: the trigger is there, the tooltip text is not', async () => {
	const { getByRole, getByText } = render(Tooltip, {
		props: { text: 'Tooltip message', children: undefined as never }
	});
	await expect.element(getByRole('button')).toHaveAttribute('data-state', 'closed');
	// The content is only rendered (in a portal) while the tooltip is open.
	await expect.element(getByText('Tooltip message')).not.toBeInTheDocument();
});
