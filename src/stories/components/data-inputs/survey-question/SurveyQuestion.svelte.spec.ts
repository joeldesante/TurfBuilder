import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SurveyQuestion from './SurveyQuestion.svelte';

describe('SurveyQuestion', () => {
	const baseProps = {
		questionNumber: 1,
		questionText: 'What is your preference?',
		questionType: 'radio' as const,
		choices: ['Option A', 'Option B', 'Option C']
	};

	describe('rendering', () => {
		it('displays the question number and text', async () => {
			const screen = render(SurveyQuestion, baseProps);
			const questionLabel = screen.getByText('What is your preference?');
			await expect.element(questionLabel).toBeVisible();
			// Question number should be visible
			const number = screen.getByText('1.');
			await expect.element(number).toBeVisible();
		});
	});

	describe('radio type', () => {
		it('renders a radiogroup with aria-label matching the question', async () => {
			const screen = render(SurveyQuestion, baseProps);
			const group = screen.getByRole('radiogroup');
			await expect.element(group).toHaveAttribute('aria-label', 'What is your preference?');
		});

		it('renders one radio button per choice', async () => {
			const screen = render(SurveyQuestion, baseProps);
			const radios = screen.container.querySelectorAll('input[type="radio"]');
			expect(radios.length).toBe(3);
		});

		it('shows choice labels', async () => {
			const screen = render(SurveyQuestion, baseProps);
			const optA = screen.getByText('Option A');
			const optB = screen.getByText('Option B');
			const optC = screen.getByText('Option C');
			await expect.element(optA).toBeVisible();
			await expect.element(optB).toBeVisible();
			await expect.element(optC).toBeVisible();
		});

		it('all radios share the same name attribute', async () => {
			const screen = render(SurveyQuestion, baseProps);
			const radios = screen.container.querySelectorAll('input[type="radio"]');
			const names = new Set(Array.from(radios).map((r) => r.getAttribute('name')));
			expect(names.size).toBe(1);
			expect(names.has('survey-q-1')).toBe(true);
		});
	});

	describe('checkbox type', () => {
		it('renders a group with aria-label matching the question', async () => {
			const screen = render(SurveyQuestion, {
				...baseProps,
				questionType: 'check'
			});
			const group = screen.getByRole('group');
			await expect.element(group).toHaveAttribute('aria-label', 'What is your preference?');
		});

		it('renders one checkbox per choice', async () => {
			const screen = render(SurveyQuestion, {
				...baseProps,
				questionType: 'check'
			});
			const checkboxes = screen.container.querySelectorAll('input[type="checkbox"]');
			expect(checkboxes.length).toBe(3);
		});
	});

	describe('text type', () => {
		it('renders a textarea instead of choices', async () => {
			const screen = render(SurveyQuestion, {
				questionNumber: 2,
				questionText: 'Any comments?',
				questionType: 'text'
			});
			const textarea = screen.getByRole('textbox');
			await expect.element(textarea).toBeVisible();
		});

		it('does not render radio or checkbox inputs for text type', async () => {
			const screen = render(SurveyQuestion, {
				questionNumber: 2,
				questionText: 'Any comments?',
				questionType: 'text'
			});
			const radios = screen.container.querySelectorAll('input[type="radio"]');
			const checkboxes = screen.container.querySelectorAll('input[type="checkbox"]');
			expect(radios.length).toBe(0);
			expect(checkboxes.length).toBe(0);
		});
	});

	describe('disabled state', () => {
		it('disables all radio inputs when disabled', async () => {
			const screen = render(SurveyQuestion, { ...baseProps, disabled: true });
			const radios = screen.container.querySelectorAll('input[type="radio"]');
			for (const radio of radios) {
				expect(radio.hasAttribute('disabled')).toBe(true);
			}
		});

		it('disables textarea when disabled', async () => {
			const screen = render(SurveyQuestion, {
				questionNumber: 2,
				questionText: 'Comments?',
				questionType: 'text',
				disabled: true
			});
			const textarea = screen.getByRole('textbox');
			await expect.element(textarea).toHaveAttribute('disabled');
		});
	});
});
