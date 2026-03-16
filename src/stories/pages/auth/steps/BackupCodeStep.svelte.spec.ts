import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import BackupCodeStep from './BackupCodeStep.svelte';

const codes = ['abc12345', 'def67890', 'ghi11223', 'jkl44556'];

describe('BackupCodeStep', () => {
	it('renders the save-your-codes instruction', async () => {
		render(BackupCodeStep, { codes });
		await expect
			.element(page.getByText(/Please save backup these codes/i))
			.toBeVisible();
	});

	it('renders each backup code', async () => {
		render(BackupCodeStep, { codes });
		for (const code of codes) {
			await expect.element(page.getByText(code)).toBeVisible();
		}
	});

	it('renders the confirmation checkbox', async () => {
		render(BackupCodeStep, { codes });
		await expect
			.element(page.getByRole('checkbox'))
			.toBeVisible();
	});

	it('renders the Confirm button disabled initially', async () => {
		render(BackupCodeStep, { codes });
		await expect.element(page.getByRole('button', { name: 'Confirm' })).toBeDisabled();
	});

	it('enables the Confirm button after checking the checkbox', async () => {
		render(BackupCodeStep, { codes });
		await page.getByRole('checkbox').click();
		await expect.element(page.getByRole('button', { name: 'Confirm' })).not.toBeDisabled();
	});
});
