import { render } from 'vitest-browser-svelte';
import { describe, it, expect, vi } from 'vitest';
import { page } from 'vitest/browser';
import ActiveImportsPage from './ActiveImportsPage.svelte';
import type { ContactImportJob } from '$lib/shared/types/contact-imports';

const job = (over: Partial<ContactImportJob> = {}): ContactImportJob => ({
	id: 'j1',
	file_id: 'f1',
	file_name: 'people.csv',
	status: 'running',
	rows_total: 1000,
	rows_processed: 250,
	rows_skipped: 0,
	error: null,
	created_at: '2026-11-15T18:00:00.000Z',
	started_at: '2026-11-15T18:01:00.000Z',
	updated_at: '2026-11-15T18:05:00.000Z',
	finished_at: null,
	...over
});

describe('ActiveImportsPage', () => {
	it('says so when no import has been started', async () => {
		render(ActiveImportsPage, { props: { orgSlug: 'acme' } });

		await expect.element(page.getByTestId('no-imports')).toBeVisible();
	});

	it('links back to Import Contacts', async () => {
		render(ActiveImportsPage, { props: { orgSlug: 'acme' } });

		await expect
			.element(page.getByRole('link', { name: 'Back to Import Contacts' }))
			.toHaveAttribute('href', '/o/acme/s/universe/data/contacts/import');
	});

	it('shows how far a running import has got', async () => {
		render(ActiveImportsPage, { props: { orgSlug: 'acme', jobs: [job()] } });

		await expect.element(page.getByText('people.csv')).toBeVisible();
		await expect.element(page.getByText('Running')).toBeVisible();
		await expect
			.element(page.getByRole('progressbar', { name: 'Progress of people.csv' }))
			.toHaveAttribute('aria-valuenow', '25');
		await expect.element(page.getByText(/250 of 1,000 rows/)).toBeVisible();
		await expect.element(page.getByText(/25% \u00b7 250 of 1,000 rows/)).toBeVisible();
	});

	it('shows the status badge in gray while running and green once done', async () => {
		render(ActiveImportsPage, {
			props: {
				orgSlug: 'acme',
				jobs: [
					job({ id: 'j1', file_name: 'a.csv' }),
					job({ id: 'j2', file_name: 'b.csv', status: 'completed', rows_processed: 1000 })
				]
			}
		});

		await expect.element(page.getByText('Running')).toHaveClass('bg-surface-container');
		await expect.element(page.getByText('Done')).toHaveClass('bg-success-container');
	});

	it('shows a waiting import with no progress yet', async () => {
		render(ActiveImportsPage, {
			props: {
				orgSlug: 'acme',
				jobs: [job({ status: 'queued', rows_processed: 0, started_at: null })]
			}
		});

		await expect.element(page.getByText('Waiting')).toBeVisible();
		await expect.element(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
	});

	it('shows a finished import at 100% under Finished', async () => {
		render(ActiveImportsPage, {
			props: {
				orgSlug: 'acme',
				jobs: [
					job({
						status: 'completed',
						rows_processed: 1000,
						finished_at: '2026-11-15T18:10:00.000Z'
					})
				]
			}
		});

		await expect.element(page.getByRole('heading', { name: 'Finished' })).toBeVisible();
		await expect.element(page.getByText('Done')).toBeVisible();
		await expect.element(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
	});

	it('fills the whole bar red when the import failed, whatever it had done', async () => {
		render(ActiveImportsPage, {
			props: { orgSlug: 'acme', jobs: [job({ status: 'failed', rows_processed: 0 })] }
		});

		const fill = page.getByTestId('import-bar-fill');
		await expect.element(fill).toHaveAttribute('data-state', 'failed');
		await expect.element(fill).toHaveClass('bg-error');
		await expect.element(fill).toHaveStyle({ width: '100%' });
	});

	it('fills the whole bar green when the import finished', async () => {
		render(ActiveImportsPage, {
			props: { orgSlug: 'acme', jobs: [job({ status: 'completed', rows_processed: 1000 })] }
		});

		const fill = page.getByTestId('import-bar-fill');
		await expect.element(fill).toHaveAttribute('data-state', 'completed');
		await expect.element(fill).toHaveClass('bg-primary');
		await expect.element(fill).toHaveStyle({ width: '100%' });
	});

	it('fills a green bar to the percent while the import runs', async () => {
		render(ActiveImportsPage, { props: { orgSlug: 'acme', jobs: [job()] } });

		const fill = page.getByTestId('import-bar-fill');
		await expect.element(fill).toHaveAttribute('data-state', 'partial');
		await expect.element(fill).toHaveClass('bar-running');
		await expect.element(fill).toHaveStyle({ width: '25%' });
	});

	it('says how many rows were left out, only when some were', async () => {
		render(ActiveImportsPage, {
			props: { orgSlug: 'acme', jobs: [job({ rows_skipped: 12 })] }
		});

		await expect.element(page.getByText(/12 skipped/)).toBeVisible();
	});

	it('does not mention skipped rows when none were', async () => {
		render(ActiveImportsPage, { props: { orgSlug: 'acme', jobs: [job()] } });

		await expect.element(page.getByText(/skipped/)).not.toBeInTheDocument();
	});

	it('shows why a failed import failed', async () => {
		render(ActiveImportsPage, {
			props: {
				orgSlug: 'acme',
				jobs: [job({ status: 'failed', error: 'The import stopped before it finished.' })]
			}
		});

		await expect.element(page.getByText('Failed')).toBeVisible();
		await expect.element(page.getByText('The import stopped before it finished.')).toBeVisible();
	});

	it('does not show a percent when the rows were never counted', async () => {
		render(ActiveImportsPage, {
			props: { orgSlug: 'acme', jobs: [job({ rows_total: null, rows_processed: 2500 })] }
		});

		await expect.element(page.getByText(/2,500 rows/)).toBeVisible();
		await expect.element(page.getByText(/%/)).not.toBeInTheDocument();
	});

	it('reads the jobs again while one is running, and shows the new progress', async () => {
		const onRefresh = vi.fn().mockResolvedValue([job({ rows_processed: 750 })]);
		render(ActiveImportsPage, {
			props: { orgSlug: 'acme', jobs: [job()], onRefresh, pollMs: 20 }
		});

		await expect.element(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
		expect(onRefresh).toHaveBeenCalled();
	});

	it('stops reading once nothing is active', async () => {
		const onRefresh = vi
			.fn()
			.mockResolvedValue([job({ status: 'completed', rows_processed: 1000 })]);
		render(ActiveImportsPage, {
			props: { orgSlug: 'acme', jobs: [job()], onRefresh, pollMs: 20 }
		});

		await expect.element(page.getByText('Done')).toBeVisible();
		const calls = onRefresh.mock.calls.length;
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(onRefresh.mock.calls.length).toBe(calls);
	});

	it('does not read at all when every import is finished', async () => {
		const onRefresh = vi.fn();
		render(ActiveImportsPage, {
			props: { orgSlug: 'acme', jobs: [job({ status: 'completed' })], onRefresh, pollMs: 20 }
		});

		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(onRefresh).not.toHaveBeenCalled();
	});

	it('keeps what is on screen when a read fails, and tries again', async () => {
		const onRefresh = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue([job({ rows_processed: 900 })]);
		render(ActiveImportsPage, {
			props: { orgSlug: 'acme', jobs: [job()], onRefresh, pollMs: 20 }
		});

		await expect.element(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '90');
	});
});
