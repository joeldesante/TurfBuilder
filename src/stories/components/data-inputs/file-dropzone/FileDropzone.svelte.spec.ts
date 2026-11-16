import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from '@vitest/browser/context';
import FileDropzone from './FileDropzone.svelte';

const csv = () => new File(['name\nAda'], 'people.csv', { type: 'text/csv' });
const pdf = () => new File(['x'], 'people.pdf', { type: 'application/pdf' });

function drop(file: File) {
	const zone = document.querySelector('[data-testid="file-dropzone"]')!;
	const dataTransfer = new DataTransfer();
	dataTransfer.items.add(file);
	zone.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));
}

function dragOver(file: File) {
	const zone = document.querySelector('[data-testid="file-dropzone"]')!;
	const dataTransfer = new DataTransfer();
	dataTransfer.items.add(file);
	zone.dispatchEvent(new DragEvent('dragover', { dataTransfer, bubbles: true, cancelable: true }));
}

describe('FileDropzone', () => {
	it('says the file must be a CSV', async () => {
		render(FileDropzone);
		await expect.element(page.getByText('Drop a CSV file here')).toBeVisible();
	});

	it('has an upload button that only accepts CSV files', async () => {
		render(FileDropzone);
		await expect.element(page.getByRole('button', { name: 'Upload CSV' })).toBeVisible();
		await expect
			.element(page.getByTestId('file-dropzone-input'))
			.toHaveAttribute('accept', '.csv,text/csv');
	});

	it('opens the file browser when the drop zone is clicked', async () => {
		render(FileDropzone);
		const input = document.querySelector<HTMLInputElement>('[data-testid="file-dropzone-input"]')!;
		const click = vi.spyOn(input, 'click');
		await page.getByTestId('file-dropzone').click({ position: { x: 5, y: 5 } });
		expect(click).toHaveBeenCalledTimes(1);
	});

	it('opens the file browser once when the upload button is clicked', async () => {
		render(FileDropzone);
		const input = document.querySelector<HTMLInputElement>('[data-testid="file-dropzone-input"]')!;
		const click = vi.spyOn(input, 'click');
		await page.getByRole('button', { name: 'Upload CSV' }).click();
		expect(click).toHaveBeenCalledTimes(1);
	});

	it('opens the file browser from the keyboard, through the upload button', async () => {
		render(FileDropzone);
		const input = document.querySelector<HTMLInputElement>('[data-testid="file-dropzone-input"]')!;
		const click = vi.spyOn(input, 'click');
		(page.getByRole('button', { name: 'Upload CSV' }).element() as HTMLElement).focus();
		await userEvent.keyboard('{Enter}');
		expect(click).toHaveBeenCalledTimes(1);
	});

	it('takes a CSV chosen with the button', async () => {
		const onUpload = vi.fn().mockResolvedValue(undefined);
		render(FileDropzone, { props: { onUpload } });
		await userEvent.upload(page.getByTestId('file-dropzone-input'), csv());
		await expect.element(page.getByText('people.csv')).toBeVisible();
		expect(onUpload).toHaveBeenCalledTimes(1);
	});

	it('takes a CSV dropped on the zone', async () => {
		const onUpload = vi.fn().mockResolvedValue(undefined);
		render(FileDropzone, { props: { onUpload } });
		drop(csv());
		await expect.element(page.getByText('people.csv')).toBeVisible();
		expect(onUpload).toHaveBeenCalledTimes(1);
	});

	it('refuses a dropped file that is not a CSV', async () => {
		const onUpload = vi.fn().mockResolvedValue(undefined);
		render(FileDropzone, { props: { onUpload } });
		drop(pdf());
		await expect.element(page.getByRole('alert')).toHaveTextContent('must be a CSV');
		expect(onUpload).not.toHaveBeenCalled();
	});

	it('ignores drops and disables the button when disabled', async () => {
		const onUpload = vi.fn().mockResolvedValue(undefined);
		render(FileDropzone, { props: { onUpload, disabled: true } });
		drop(csv());
		await expect.element(page.getByRole('button', { name: 'Upload CSV' })).toBeDisabled();
		expect(onUpload).not.toHaveBeenCalled();
	});

	it('turns red while a file that is not a CSV is held over it', async () => {
		render(FileDropzone);
		dragOver(pdf());
		await expect.element(page.getByTestId('file-dropzone')).toHaveClass(/border-error/);
	});

	it('turns green while a CSV is held over it', async () => {
		render(FileDropzone);
		dragOver(csv());
		await expect.element(page.getByTestId('file-dropzone')).toHaveClass(/border-success/);
		await expect.element(page.getByTestId('file-dropzone')).not.toHaveClass(/border-error/);
	});

	it('starts uploading as soon as a CSV is dropped, and passes the file', async () => {
		const onUpload = vi.fn().mockReturnValue(new Promise(() => {}));
		render(FileDropzone, { props: { onUpload } });
		drop(csv());
		await expect.element(page.getByText('Uploading people.csv')).toBeVisible();
		expect(onUpload.mock.calls[0][0].name).toBe('people.csv');
	});

	it('fills the whole zone as the progress bar', async () => {
		let report: (percent: number) => void = () => {};
		const onUpload = vi.fn((_file: File, onProgress: (percent: number) => void) => {
			report = onProgress;
			return new Promise<void>(() => {});
		});
		render(FileDropzone, { props: { onUpload } });
		drop(csv());
		await expect.element(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
		report(40);
		await expect.element(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
		await expect.element(page.getByText('40%')).toBeVisible();
	});

	it('says Uploaded at 100% when the upload finishes', async () => {
		const onUpload = vi.fn().mockResolvedValue(undefined);
		render(FileDropzone, { props: { onUpload } });
		drop(csv());
		await expect.element(page.getByText('Uploaded')).toBeVisible();
		await expect.element(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
	});

	it('ignores another drop while an upload is running', async () => {
		const onUpload = vi.fn().mockReturnValue(new Promise(() => {}));
		render(FileDropzone, { props: { onUpload } });
		drop(csv());
		await expect.element(page.getByText('Uploading people.csv')).toBeVisible();
		drop(csv());
		expect(onUpload).toHaveBeenCalledTimes(1);
		await expect.element(page.getByRole('button', { name: 'Upload CSV' })).toBeDisabled();
	});

	it('shows the failure message and goes back to the prompt when the upload fails', async () => {
		const onUpload = vi.fn().mockRejectedValue(new Error('Could not reach storage.'));
		render(FileDropzone, { props: { onUpload } });
		drop(csv());
		await expect.element(page.getByRole('alert')).toHaveTextContent('Could not reach storage.');
		await expect.element(page.getByText('Drop a CSV file here')).toBeVisible();
	});
});
