import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import { createRawSnippet } from 'svelte';
import Pagination from './Pagination.svelte';

const base = { page: 1, totalCount: 250, pageSize: 100, noun: 'locations' };

test('summarizes the rows on this page', async () => {
	const { getByText } = render(Pagination, { props: { ...base, page: 3 } });

	await expect.element(getByText('Showing 201–250 of 250 locations.')).toBeVisible();
});

test('formats large counts', async () => {
	const { getByText } = render(Pagination, { props: { ...base, totalCount: 12345 } });

	await expect.element(getByText('Showing 1–100 of 12,345 locations.')).toBeVisible();
});

test('renders nothing when there are no rows', async () => {
	const { getByRole } = render(Pagination, { props: { ...base, totalCount: 0 } });

	await expect.element(getByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
});

test('offers no page links when everything fits on one page', async () => {
	const { getByRole, getByText } = render(Pagination, { props: { ...base, totalCount: 40 } });

	await expect.element(getByText('Showing 1–40 of 40 locations.')).toBeVisible();
	await expect.element(getByRole('link', { name: 'Next page' })).not.toBeInTheDocument();
});

test('links to every page when there are few', async () => {
	const { getByRole } = render(Pagination, { props: base });

	await expect.element(getByRole('link', { name: 'Page 2' })).toHaveAttribute('href', '?page=2');
	await expect.element(getByRole('link', { name: 'Page 3' })).toBeVisible();
});

test('marks the current page', async () => {
	const { getByRole } = render(Pagination, { props: { ...base, page: 2 } });

	await expect.element(getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
});

test('previous and next point at the neighbors', async () => {
	const { getByRole } = render(Pagination, { props: { ...base, page: 2 } });

	await expect.element(getByRole('link', { name: 'Previous page' })).toHaveAttribute('href', '?page=1');
	await expect.element(getByRole('link', { name: 'Next page' })).toHaveAttribute('href', '?page=3');
});

test('cannot step before the first or past the last page', async () => {
	const first = render(Pagination, { props: base });
	await expect.element(first.getByRole('button', { name: 'Previous page' })).toBeDisabled();
	first.unmount();

	const last = render(Pagination, { props: { ...base, page: 3 } });
	await expect.element(last.getByRole('button', { name: 'Next page' })).toBeDisabled();
});

test('windows a long list around the current page and keeps both ends', async () => {
	const { getByRole } = render(Pagination, {
		props: { ...base, page: 10, totalCount: 2000 }
	});

	for (const n of [1, 9, 10, 11, 20]) {
		await expect.element(getByRole('link', { name: `Page ${n}`, exact: true })).toBeVisible();
	}
	await expect.element(getByRole('link', { name: 'Page 5', exact: true })).not.toBeInTheDocument();
});

test('builds links with the href function when given one', async () => {
	const { getByRole } = render(Pagination, {
		props: { ...base, page: 2, href: (p: number) => `?q=ada&page=${p}` }
	});

	await expect.element(getByRole('link', { name: 'Page 3' })).toHaveAttribute('href', '?q=ada&page=3');
	await expect.element(getByRole('link', { name: 'Previous page' })).toHaveAttribute('href', '?q=ada&page=1');
});

test('renders extra text after the summary', async () => {
	const children = createRawSnippet(() => ({ render: () => '<span>Use search to filter.</span>' }));
	const { getByText } = render(Pagination, { props: { ...base, children } });

	await expect.element(getByText('Use search to filter.')).toBeVisible();
});
