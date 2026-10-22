import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import { createRawSnippet } from 'svelte';
import { expect, test } from 'vitest';
import ChartFrame from './ChartFrame.svelte';

const plot = createRawSnippet((width: () => number) => ({ render: () => `<p>Plot ${width() > 0 ? 'measured' : 'unmeasured'}</p>` }));

test('renders the plot once its width is known', async () => {
	render(ChartFrame, { props: { title: 'Visits', children: plot } });

	await expect.element(page.getByRole('heading', { name: 'Visits' })).toBeVisible();
	await expect.element(page.getByText('Plot measured')).toBeVisible();
});

test('shows loading, error, and empty states instead of the plot', async () => {
	const loading = render(ChartFrame, { props: { title: 'Visits', loading: true, children: plot } });
	await expect.element(page.getByRole('status')).toHaveTextContent('Loading Visits');
	loading.unmount();

	const failed = render(ChartFrame, { props: { title: 'Visits', error: 'Could not load.', children: plot } });
	await expect.element(page.getByRole('alert')).toHaveTextContent('Could not load.');
	failed.unmount();

	render(ChartFrame, { props: { title: 'Visits', empty: true, emptyText: 'No visits.', children: plot } });
	await expect.element(page.getByText('No visits.')).toBeVisible();
	await expect.element(page.getByText(/^Plot/)).not.toBeInTheDocument();
});

test('offers a CSV download only when it has data', async () => {
	const withData = render(ChartFrame, { props: { title: 'Visits', csv: () => 'a,b', children: plot } });
	await expect.element(page.getByRole('button', { name: 'Download Visits as CSV' })).toBeVisible();
	withData.unmount();

	render(ChartFrame, { props: { title: 'Visits', csv: () => 'a,b', empty: true, children: plot } });
	await expect.element(page.getByRole('button', { name: 'Download Visits as CSV' })).not.toBeInTheDocument();
});
