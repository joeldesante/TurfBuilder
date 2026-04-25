import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import TagInput from './TagInput.svelte';

describe('TagInput', () => {
	it('renders existing tags', async () => {
		render(TagInput, { tags: ['https://turfbuilder.org'], onchange: () => {} });
		await expect.element(page.getByText('https://turfbuilder.org')).toBeVisible();
	});

	it('renders the input', async () => {
		render(TagInput, { tags: [], placeholder: 'Add a domain', onchange: () => {} });
		await expect.element(page.getByPlaceholder('Add a domain')).toBeVisible();
	});

	it('calls onchange with new tag when Enter is pressed', async () => {
		const onchange = vi.fn();
		render(TagInput, { tags: [], onchange });

		const input = page.getByRole('textbox');
		await input.fill('https://example.com');
		await input.press('Enter');

		expect(onchange).toHaveBeenCalledWith(['https://example.com']);
	});

	it('calls onchange without tag when X is clicked', async () => {
		const onchange = vi.fn();
		render(TagInput, { tags: ['https://turfbuilder.org'], onchange });

		await page.getByRole('button', { name: 'Remove https://turfbuilder.org' }).click();

		expect(onchange).toHaveBeenCalledWith([]);
	});

	it('removes last tag on Backspace when input is empty', async () => {
		const onchange = vi.fn();
		render(TagInput, { tags: ['https://turfbuilder.org', 'https://www.turfbuilder.org'], onchange });

		await page.getByRole('textbox').press('Backspace');

		expect(onchange).toHaveBeenCalledWith(['https://turfbuilder.org']);
	});

	it('does not add duplicate tags', async () => {
		const onchange = vi.fn();
		render(TagInput, { tags: ['https://turfbuilder.org'], onchange });

		const input = page.getByRole('textbox');
		await input.fill('https://turfbuilder.org');
		await input.press('Enter');

		expect(onchange).not.toHaveBeenCalled();
	});
});
