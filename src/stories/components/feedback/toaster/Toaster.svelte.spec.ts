import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import { afterEach, expect, test } from 'vitest';
import { toast } from 'svelte-sonner';
import Toaster from './Toaster.svelte';

afterEach(() => {
	toast.dismiss();
});

test('shows an error toast raised from anywhere', async () => {
	render(Toaster);

	toast.error('The PDF could not be generated.');

	await expect.element(page.getByText('The PDF could not be generated.')).toBeVisible();
});

test('shows a description under the title', async () => {
	render(Toaster);

	toast.error('Could not generate the PDF', { description: 'Object storage is not configured.' });

	await expect.element(page.getByText('Could not generate the PDF')).toBeVisible();
	await expect.element(page.getByText('Object storage is not configured.')).toBeVisible();
});

test('can be dismissed with the close button', async () => {
	render(Toaster);

	toast.error('Dismiss me');
	await expect.element(page.getByText('Dismiss me')).toBeVisible();
	// Scoped to this toast: earlier tests' toasts may still be animating out.
	await page
		.getByRole('listitem')
		.filter({ hasText: 'Dismiss me' })
		.getByRole('button', { name: 'Close toast' })
		.click();

	await expect.element(page.getByText('Dismiss me')).not.toBeInTheDocument();
});

test('closes on its own after the duration', async () => {
	render(Toaster, { props: { duration: 300 } });

	toast('Short lived');
	await expect.element(page.getByText('Short lived')).toBeVisible();

	await expect.element(page.getByText('Short lived'), { timeout: 3000 }).not.toBeInTheDocument();
});
