import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import SqlPreview from './SqlPreview.svelte';

const sql = 'SELECT vl.id FROM universe.v_locations vl WHERE (lower(vl.city) = lower($1))';

test('shows the query laid out one clause per line', async () => {
	const { getByLabelText } = render(SqlPreview, { props: { sql } });

	const block = getByLabelText('Generated SQL');
	await expect.element(block).toHaveTextContent('lower(vl.city) = lower($1)');
	expect(block.element().textContent).toContain('\nFROM universe.v_locations vl');
});

test('colors the keywords', async () => {
	const { getByText } = render(SqlPreview, { props: { sql } });

	await expect.element(getByText('SELECT', { exact: true })).toHaveClass('text-info');
});

test('lists each parameter by its placeholder', async () => {
	const { getByLabelText } = render(SqlPreview, { props: { sql, params: ['Austin', 65] } });

	await expect.element(getByLabelText('Query parameters')).toHaveTextContent("$1 = 'Austin'");
	await expect.element(getByLabelText('Query parameters')).toHaveTextContent('$2 = 65');
});

test('has no parameter list when there are none', async () => {
	const { getByLabelText } = render(SqlPreview, { props: { sql } });

	await expect.element(getByLabelText('Query parameters')).not.toBeInTheDocument();
});

test('takes its own name, so a page can show several', async () => {
	const { getByLabelText } = render(SqlPreview, { props: { sql, label: 'People SQL' } });

	await expect.element(getByLabelText('People SQL')).toBeVisible();
});
