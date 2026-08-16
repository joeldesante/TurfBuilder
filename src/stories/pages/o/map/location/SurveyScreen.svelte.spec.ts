import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import SurveyScreen from './SurveyScreen.svelte';

const location = {
	location_name: "Smith Residence",
	street: '123 Main St',
	locality: 'Springfield',
	region: 'IL',
	postcode: '62701'
};

const questions = [
	{
		db_id: 'q1',
		type: 'radio' as const,
		text: 'Do you support the proposal?',
		choices: ['Yes', 'No', 'Undecided'],
		index: 0,
		response: ''
	}
];

const baseProps = {
	location,
	questions,
	contactStatus: null,
	backHref: '/o/my-org/map/t1',
	onSubmit: vi.fn()
};

describe('SurveyScreen', () => {
	describe('rendering', () => {
		it('renders the location name', async () => {
			render(SurveyScreen, baseProps);
			await expect
				.element(page.getByRole('heading', { level: 1 }))
				.toHaveTextContent('Smith Residence');
		});

		it('renders the location street', async () => {
			render(SurveyScreen, baseProps);
			await expect.element(page.getByText('123 Main St')).toBeVisible();
		});

		it('renders the back-to-map link', async () => {
			render(SurveyScreen, baseProps);
			const link = page.getByRole('link', { name: /Back to map/i });
			await expect.element(link).toBeVisible();
			expect(link.element().getAttribute('href')).toBe('/o/my-org/map/t1');
		});

		it('renders the "Were you able to make contact?" question', async () => {
			render(SurveyScreen, baseProps);
			await expect.element(page.getByText('Were you able to make contact?')).toBeVisible();
		});

		it('renders the Notes field', async () => {
			render(SurveyScreen, baseProps);
			await expect.element(page.getByLabelText('Notes')).toBeVisible();
		});

		it('renders the Save button', async () => {
			render(SurveyScreen, baseProps);
			await expect.element(page.getByRole('button', { name: 'Save' })).toBeVisible();
		});
	});

	describe('questions visibility', () => {
		it('hides questions when contact was not made', async () => {
			render(SurveyScreen, { ...baseProps, contactStatus: 'no_contact' });
			await expect
				.element(page.getByText('Do you support the proposal?'))
				.not.toBeInTheDocument();
		});

		it('shows questions when contact was made', async () => {
			render(SurveyScreen, { ...baseProps, contactStatus: 'contacted' });
			await expect.element(page.getByText('Do you support the proposal?')).toBeVisible();
		});
	});

	describe('submit button', () => {
		it('calls onSubmit when Save is clicked', async () => {
			const onSubmit = vi.fn();
			render(SurveyScreen, { ...baseProps, contactStatus: 'contacted', onSubmit });
			await page.getByRole('button', { name: 'Save' }).click();
			expect(onSubmit).toHaveBeenCalled();
		});

		it('disables the button when loading', async () => {
			render(SurveyScreen, { ...baseProps, contactStatus: 'contacted', loading: true });
			await expect.element(page.getByRole('button', { name: 'Save' })).toBeDisabled();
		});

		it('disables the button when no contact status is selected', async () => {
			render(SurveyScreen, { ...baseProps, contactStatus: null });
			await expect.element(page.getByRole('button', { name: 'Save' })).toBeDisabled();
		});
	});
});
