import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import ColorSwatchPicker from './ColorSwatchPicker.svelte';
import { LAYER_COLORS } from '$lib/shared/utils/layer-colors';

describe('ColorSwatchPicker', () => {
	it('shows every color in the list', async () => {
		render(ColorSwatchPicker, { props: { value: LAYER_COLORS[0].value, onChange: vi.fn() } });

		await expect.element(page.getByRole('radiogroup', { name: 'Color' })).toBeVisible();
		for (const color of LAYER_COLORS) {
			await expect.element(page.getByRole('radio', { name: color.name })).toBeVisible();
		}
	});

	it('marks only the chosen color as checked', async () => {
		render(ColorSwatchPicker, { props: { value: '#2f6fed', onChange: vi.fn() } });

		await expect.element(page.getByRole('radio', { name: 'Blue' })).toBeChecked();
		await expect.element(page.getByRole('radio', { name: 'Red' })).not.toBeChecked();
	});

	it('reports the color that was clicked', async () => {
		const onChange = vi.fn();
		render(ColorSwatchPicker, { props: { value: '#2f6fed', onChange } });

		await page.getByRole('radio', { name: 'Green' }).click();

		expect(onChange).toHaveBeenCalledWith('#2a9d4b');
	});
});
