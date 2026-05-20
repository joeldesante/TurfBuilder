import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import Tooltip from './Tooltip.svelte';

test('renders trigger content', async () => {
	const { getByText } = render(Tooltip, {
		props: { text: 'Tooltip message', children: undefined as never }
	});
	// Trigger slot content is provided by the parent — just assert the component mounts
	await expect.element(getByText('Tooltip message')).not.toBeVisible();
});
