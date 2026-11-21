import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from '@vitest/browser/context';
import { toast } from 'svelte-sonner';
import Toaster from '$components/feedback/toaster/Toaster.svelte';
import BucketSettingsPage from './BucketSettingsPage.svelte';

const baseProps = {
	bucketName: 'Austin voters',
	onRename: vi.fn().mockResolvedValue(undefined),
	onDelete: vi.fn().mockResolvedValue(undefined)
};

afterEach(() => {
	toast.dismiss();
	vi.clearAllMocks();
	baseProps.onRename.mockResolvedValue(undefined);
	baseProps.onDelete.mockResolvedValue(undefined);
});

describe('BucketSettingsPage', () => {
	it('shows the page title and the bucket it belongs to', async () => {
		render(BucketSettingsPage, { props: baseProps });
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Settings');
		await expect.element(page.getByText('Austin voters').first()).toBeVisible();
	});

	describe('renaming', () => {
		it('starts with the current name and nothing to save', async () => {
			render(BucketSettingsPage, { props: baseProps });
			await expect.element(page.getByLabelText('Bucket name')).toHaveValue('Austin voters');
			await expect.element(page.getByRole('button', { name: 'Save Name' })).toBeDisabled();
		});

		it('saves the trimmed new name', async () => {
			render(BucketSettingsPage, { props: baseProps });
			render(Toaster);

			await page.getByLabelText('Bucket name').fill('  Houston voters  ');
			await page.getByRole('button', { name: 'Save Name' }).click();

			expect(baseProps.onRename).toHaveBeenCalledWith('Houston voters');
			await expect.element(page.getByText('Bucket renamed.')).toBeVisible();
			await expect.element(page.getByRole('button', { name: 'Save Name' })).toBeDisabled();
		});

		it('saves from the keyboard with Enter', async () => {
			render(BucketSettingsPage, { props: baseProps });
			await page.getByLabelText('Bucket name').fill('Houston voters');
			await userEvent.keyboard('{Enter}');
			expect(baseProps.onRename).toHaveBeenCalledWith('Houston voters');
		});

		it('does not save a blank name', async () => {
			render(BucketSettingsPage, { props: baseProps });
			await page.getByLabelText('Bucket name').fill('   ');
			await expect.element(page.getByRole('button', { name: 'Save Name' })).toBeDisabled();
		});

		it('does not save an unchanged name, even with other spacing', async () => {
			render(BucketSettingsPage, { props: baseProps });
			await page.getByLabelText('Bucket name').fill(' Austin voters ');
			await expect.element(page.getByRole('button', { name: 'Save Name' })).toBeDisabled();
		});

		it('shows the error and keeps the new name in the box when the save fails', async () => {
			const onRename = vi.fn().mockRejectedValue(new Error('A bucket with that name exists.'));
			render(BucketSettingsPage, { props: { ...baseProps, onRename } });
			render(Toaster);

			await page.getByLabelText('Bucket name').fill('Houston voters');
			await page.getByRole('button', { name: 'Save Name' }).click();

			await expect.element(page.getByText('A bucket with that name exists.')).toBeVisible();
			await expect.element(page.getByLabelText('Bucket name')).toHaveValue('Houston voters');
			await expect.element(page.getByRole('button', { name: 'Save Name' })).toBeEnabled();
		});
	});

	describe('deleting', () => {
		it('asks to confirm before deleting anything', async () => {
			render(BucketSettingsPage, { props: baseProps });
			await page.getByRole('button', { name: 'Delete Bucket' }).click();

			const dialog = page.getByRole('dialog');
			await expect.element(dialog.getByText('Delete this bucket?')).toBeVisible();
			expect(baseProps.onDelete).not.toHaveBeenCalled();
		});

		it('does not delete when cancelled', async () => {
			render(BucketSettingsPage, { props: baseProps });
			await page.getByRole('button', { name: 'Delete Bucket' }).click();
			await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

			expect(baseProps.onDelete).not.toHaveBeenCalled();
			await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		});

		it('deletes the bucket once confirmed', async () => {
			render(BucketSettingsPage, { props: baseProps });
			await page.getByRole('button', { name: 'Delete Bucket' }).click();
			await page.getByRole('dialog').getByRole('button', { name: 'Delete Bucket' }).click();

			expect(baseProps.onDelete).toHaveBeenCalledTimes(1);
		});

		it('keeps the dialog open and shows the error when deleting fails', async () => {
			const onDelete = vi.fn().mockRejectedValue(new Error('You cannot delete this bucket.'));
			render(BucketSettingsPage, { props: { ...baseProps, onDelete } });
			await page.getByRole('button', { name: 'Delete Bucket' }).click();
			await page.getByRole('dialog').getByRole('button', { name: 'Delete Bucket' }).click();

			await expect
				.element(page.getByRole('dialog').getByText('You cannot delete this bucket.'))
				.toBeVisible();
		});
	});
});
