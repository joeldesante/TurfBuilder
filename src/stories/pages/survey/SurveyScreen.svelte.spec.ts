import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import SurveyScreen from './SurveyScreen.svelte';

const location = {
	location_name: '123 Main St',
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
	backHref: '/o/my-org/map/t1',
	onSubmit: vi.fn()
};

describe('SurveyScreen', () => {
	describe('rendering', () => {
		it('renders the location name', async () => {
			render(SurveyScreen, baseProps);
			await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('123 Main St');
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

		it('renders the "Did you speak with them?" switch', async () => {
			render(SurveyScreen, baseProps);
			await expect.element(page.getByText('Did you speak with them?')).toBeVisible();
		});

		it('renders the Notes field', async () => {
			render(SurveyScreen, baseProps);
			await expect.element(page.getByLabelText('Notes')).toBeVisible();
		});

		it('renders the Submit Response button', async () => {
			render(SurveyScreen, baseProps);
			await expect.element(page.getByRole('button', { name: 'Submit Response' })).toBeVisible();
		});
	});

	describe('questions visibility', () => {
		it('hides questions when contact was not made', async () => {
			render(SurveyScreen, { ...baseProps, contactMade: false });
			await expect
				.element(page.getByText('Do you support the proposal?'))
				.not.toBeInTheDocument();
		});

		it('shows questions when contact was made', async () => {
			render(SurveyScreen, { ...baseProps, contactMade: true });
			await expect.element(page.getByText('Do you support the proposal?')).toBeVisible();
		});
	});

	describe('submit button', () => {
		it('calls onSubmit when Submit Response is clicked', async () => {
			const onSubmit = vi.fn();
			render(SurveyScreen, { ...baseProps, onSubmit });
			await page.getByRole('button', { name: 'Submit Response' }).click();
			expect(onSubmit).toHaveBeenCalled();
		});

		it('disables the button when loading', async () => {
			render(SurveyScreen, { ...baseProps, loading: true });
			await expect.element(page.getByRole('button', { name: 'Submit Response' })).toBeDisabled();
		});
	});
});
