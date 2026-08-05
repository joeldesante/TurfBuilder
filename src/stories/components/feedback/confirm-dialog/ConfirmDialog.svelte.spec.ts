import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog.svelte';

const base = {
	open: true,
	title: 'Delete this location?',
	description: 'Past canvassing responses are kept.',
	onConfirm: () => {},
	onCancel: () => {}
};

test('renders the title and description', async () => {
	const { getByText } = render(ConfirmDialog, { props: base });

	await expect.element(getByText('Delete this location?')).toBeVisible();
	await expect.element(getByText('Past canvassing responses are kept.')).toBeVisible();
});

test('renders nothing while closed', async () => {
	const { getByText } = render(ConfirmDialog, { props: { ...base, open: false } });

	await expect.element(getByText('Delete this location?')).not.toBeInTheDocument();
});

test('calls onConfirm when the confirm button is pressed', async () => {
	const onConfirm = vi.fn();
	const { getByRole } = render(ConfirmDialog, {
		props: { ...base, confirmLabel: 'Delete', onConfirm }
	});

	await getByRole('button', { name: 'Delete' }).click();

	expect(onConfirm).toHaveBeenCalledTimes(1);
});

test('calls onCancel when the cancel button is pressed', async () => {
	const onCancel = vi.fn();
	const { getByRole } = render(ConfirmDialog, { props: { ...base, onCancel } });

	await getByRole('button', { name: 'Cancel' }).click();

	expect(onCancel).toHaveBeenCalledTimes(1);
});

test('uses the supplied button labels', async () => {
	const { getByRole } = render(ConfirmDialog, {
		props: { ...base, confirmLabel: 'Reject', cancelLabel: 'Keep it' }
	});

	await expect.element(getByRole('button', { name: 'Reject' })).toBeVisible();
	await expect.element(getByRole('button', { name: 'Keep it' })).toBeVisible();
});

test('surfaces an error message', async () => {
	const { getByRole } = render(ConfirmDialog, {
		props: { ...base, error: 'You do not have permission to delete locations.' }
	});

	await expect
		.element(getByRole('alert'))
		.toHaveTextContent('You do not have permission to delete locations.');
});

// Cancel is disabled mid-flight so the dialog cannot be dismissed out from
// under an in-progress delete.
test('disables cancel while the action is in flight', async () => {
	const { getByRole } = render(ConfirmDialog, { props: { ...base, loading: true } });

	await expect.element(getByRole('button', { name: 'Cancel' })).toBeDisabled();
});
