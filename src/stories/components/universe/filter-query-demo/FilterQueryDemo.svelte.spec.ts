import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import FilterQueryDemo from './FilterQueryDemo.svelte';
import type { FilterGroup } from '$lib/shared/types/filters';

const city: FilterGroup = {
	operator: 'AND',
	filters: [{ item: 'city', operation: 'equals', value: 'Austin' }]
};

test('shows the JSON the editor holds', async () => {
	const { getByLabelText } = render(FilterQueryDemo, { props: { group: city } });

	await expect.element(getByLabelText('Filter JSON')).toHaveTextContent('"item": "city"');
});

test('shows the SQL and its parameters', async () => {
	const { getByLabelText } = render(FilterQueryDemo, { props: { group: city } });

	await expect
		.element(getByLabelText('Generated SQL'))
		.toHaveTextContent('lower(vl.city) = lower($1)');
	await expect.element(getByLabelText('Query parameters')).toHaveTextContent("$1 = 'Austin'");
});

test('matches everything for an empty tree', async () => {
	const { getByLabelText } = render(FilterQueryDemo, {});

	await expect
		.element(getByLabelText('Generated SQL'))
		.toHaveTextContent('SELECT vl.id, vl.source FROM universe.v_locations vl');
});

test('says why an incomplete filter cannot be compiled', async () => {
	const { getByRole } = render(FilterQueryDemo, {
		props: {
			group: { operator: 'AND', filters: [{ item: 'city', operation: 'equals', value: '' }] }
		}
	});

	await expect.element(getByRole('alert')).toHaveTextContent('City needs a valid value');
});

test('reports a filter that does not apply to the entity type', async () => {
	const { getByRole } = render(FilterQueryDemo, { props: { entity: 'people', group: city } });

	await expect.element(getByRole('alert')).toHaveTextContent('cannot be used to filter people');
});

test('rebuilds the SQL when a filter is added in the editor', async () => {
	const { getByRole, getByLabelText } = render(FilterQueryDemo, {});

	await getByRole('button', { name: /add filter/i }).click();
	await getByRole('button', { name: 'City' }).click();

	await expect.element(getByLabelText('Filter JSON')).toHaveTextContent('"item": "city"');
});

test('highlights the SQL keywords', async () => {
	const { getByLabelText } = render(FilterQueryDemo, { props: { group: city } });

	const sql = getByLabelText('Generated SQL');
	await expect.element(sql.getByText('SELECT', { exact: true })).toHaveClass('font-bold');
	await expect
		.element(sql.getByText('lower', { exact: true }).first())
		.not.toHaveClass('font-bold');
});

test('compiles a survey response filter', async () => {
	const { getByLabelText } = render(FilterQueryDemo, {
		props: {
			group: {
				operator: 'AND',
				filters: [
					{
						item: 'survey_question_response',
						operation: 'equals',
						value: {
							bucketId: '11111111-1111-4111-8111-111111111111',
							surveyId: '22222222-2222-4222-8222-222222222222',
							questionId: '33333333-3333-4333-8333-333333333333',
							response: 'Undecided'
						}
					}
				]
			}
		}
	});

	await expect.element(getByLabelText('Generated SQL')).toHaveTextContent('survey_question_response');
	await expect.element(getByLabelText('Query parameters')).toHaveTextContent("$1 = 'Undecided'");
});
