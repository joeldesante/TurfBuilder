import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import DragHandle from './DragHandle.svelte';

test('is a labelled draggable control', async () => {
	const { getByRole } = render(DragHandle, { props: { ondragstart: () => {} } });

	const handle = getByRole('button', { name: 'Drag to reorder' });
	await expect.element(handle).toBeVisible();
	await expect.element(handle).toHaveAttribute('draggable', 'true');
});
