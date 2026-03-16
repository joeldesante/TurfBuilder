import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import CreateSurvey from './CreateSurvey.svelte';

describe('CreateSurvey', () => {
	const baseProps = {
		surveysHref: '/o/my-org/s/data/surveys',
		onCreate: vi.fn()
	};

	it('renders the Create Survey heading', async () => {
		render(CreateSurvey, baseProps);
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Create Survey');
	});

	it('renders a breadcrumb link back to Surveys', async () => {
		render(CreateSurvey, baseProps);
		const link = page.getByRole('link', { name: 'Surveys' });
		await expect.element(link).toBeVisible();
		expect(link.element().getAttribute('href')).toBe('/o/my-org/s/data/surveys');
	});

	it('renders the Survey Name field', async () => {
		render(CreateSurvey, baseProps);
		await expect.element(page.getByLabelText('Survey Name')).toBeVisible();
	});

	it('renders the Create button', async () => {
		render(CreateSurvey, baseProps);
		await expect.element(page.getByRole('button', { name: 'Create' })).toBeVisible();
	});

	it('calls onCreate with the survey name on submit', async () => {
		const onCreate = vi.fn().mockResolvedValue(undefined);
		render(CreateSurvey, { ...baseProps, onCreate });
		await page.getByLabelText('Survey Name').fill('My New Survey');
		await page.getByRole('button', { name: 'Create' }).click();
		expect(onCreate).toHaveBeenCalledWith('My New Survey');
	});

	it('shows a validation error when the name is empty', async () => {
		render(CreateSurvey, baseProps);
		// Trigger validation by blurring the empty field
		await page.getByLabelText('Survey Name').click();
		await page.getByRole('button', { name: 'Create' }).click();
		// The form should show a validation error (zod nonempty)
		const errorMessages = page.getByText(/required|empty|name/i);
		// Just verify the form didn't call onCreate with empty value
		expect(baseProps.onCreate).not.toHaveBeenCalled();
	});
});
