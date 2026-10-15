import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import FilterConversionDemo from './FilterConversionDemo.svelte';

test('converts the first example and shows each step', async () => {
	const { getByLabelText } = render(FilterConversionDemo);

	await expect.element(getByLabelText('Stored old filter')).toHaveTextContent('"vl.city"');
	await expect.element(getByLabelText('Converted filters')).toHaveTextContent('"item": "city"');
	await expect.element(getByLabelText('Converted filters')).toHaveTextContent('"caseSensitive": true');
	await expect.element(getByLabelText('Locations SQL')).toHaveTextContent('vl.city = $1');
});

test('shows the converted filter in the editor as a sentence', async () => {
	const { getByText } = render(FilterConversionDemo);

	await expect.element(getByText(/Locations whose city is Austin/)).toBeVisible();
});

test('shows "none of these" as the "at least one condition is false" it was stored as', async () => {
	const { getByRole, getByLabelText } = render(FilterConversionDemo);

	await getByRole('button', { name: 'Example' }).click();
	await getByRole('option', { name: /None of these/ }).click();

	await expect.element(getByLabelText('Converted filters')).toHaveTextContent('"not": true');
	await expect.element(getByRole('button', { name: 'Group operator' })).toHaveTextContent('Locations where at least one condition below is false');
});

test('shows a result for each kind of record the bucket includes', async () => {
	const { getByRole } = render(FilterConversionDemo);

	await getByRole('button', { name: 'Example' }).click();
	await getByRole('option', { name: 'People and locations' }).click();

	await expect.element(getByRole('region', { name: 'People result' })).toBeVisible();
	await expect.element(getByRole('region', { name: 'Locations result' })).toBeVisible();
});

test('says why an old filter cannot be converted', async () => {
	const { getByRole, getByLabelText } = render(FilterConversionDemo);

	await getByRole('button', { name: 'Example' }).click();
	await getByRole('option', { name: /Cannot convert/ }).click();

	await expect.element(getByRole('alert')).toHaveTextContent('the text contains % or _');
	await expect.element(getByLabelText('Converted filters')).not.toBeInTheDocument();
});

test('converts what is typed', async () => {
	const { getByLabelText } = render(FilterConversionDemo);

	await getByLabelText('Old filter', { exact: true }).fill(
		JSON.stringify({
			people: { enabled: false, matchType: 'ALL', conditions: [] },
			locations: { enabled: true, matchType: 'ALL', conditions: [{ filterId: 'state', qualifierId: 'is', value: 'TX' }] }
		})
	);

	await expect.element(getByLabelText('Converted filters')).toHaveTextContent('"item": "state"');
});

test('says so when what is typed is not valid', async () => {
	const { getByLabelText, getByRole } = render(FilterConversionDemo);

	await getByLabelText('Old filter', { exact: true }).fill('{ not json');

	await expect.element(getByRole('alert')).toBeVisible();
	await expect.element(getByLabelText('Stored old filter')).not.toBeInTheDocument();
});

test('starts from a given old filter', async () => {
	const { getByLabelText } = render(FilterConversionDemo, {
		props: {
			input: {
				people: { enabled: true, matchType: 'ALL', conditions: [{ filterId: 'age', qualifierId: 'gt', value: '65' }] },
				locations: { enabled: false, matchType: 'ALL', conditions: [] }
			}
		}
	});

	await expect.element(getByLabelText('People SQL')).toHaveTextContent('EXTRACT(YEAR FROM AGE(CURRENT_DATE, vp.dob)) > $1');
});
