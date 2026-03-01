import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SurveyAnswerOption from './SurveyAnswerOption.svelte';

describe('SurveyAnswerOption', () => {
	describe('rendering', () => {
		it('renders a radio input with the label text', async () => {
			const screen = render(SurveyAnswerOption, { type: 'radio', label: 'Option A' });
			const radio = screen.getByRole('radio');
			await expect.element(radio).toBeInTheDocument();
			const label = screen.getByText('Option A');
			await expect.element(label).toBeVisible();
		});

		it('renders a checkbox input with the label text', async () => {
			const screen = render(SurveyAnswerOption, { type: 'checkbox', label: 'Option B' });
			const checkbox = screen.getByRole('checkbox');
			await expect.element(checkbox).toBeInTheDocument();
			const label = screen.getByText('Option B');
			await expect.element(label).toBeVisible();
		});

		it('sets name and value attributes on the input', async () => {
			const screen = render(SurveyAnswerOption, {
				type: 'radio',
				label: 'Yes',
				name: 'q1',
				value: 'yes'
			});
			const radio = screen.getByRole('radio');
			await expect.element(radio).toHaveAttribute('name', 'q1');
			await expect.element(radio).toHaveAttribute('value', 'yes');
		});
	});

	describe('selected state', () => {
		it('radio is not checked by default', async () => {
			const screen = render(SurveyAnswerOption, { type: 'radio', label: 'A' });
			const radio = screen.getByRole('radio');
			expect(radio.element().checked).toBe(false);
		});

		it('radio is checked when selected is true', async () => {
			const screen = render(SurveyAnswerOption, {
				type: 'radio',
				label: 'A',
				selected: true
			});
			const radio = screen.getByRole('radio');
			expect(radio.element().checked).toBe(true);
		});

		it('applies selected styling when selected', async () => {
			const screen = render(SurveyAnswerOption, {
				type: 'radio',
				label: 'A',
				selected: true
			});
			// The wrapping label gets bg-primary-container when selected
			const label = screen.container.querySelector('label');
			expect(label?.classList.contains('bg-primary-container')).toBe(true);
		});

		it('applies unselected styling by default', async () => {
			const screen = render(SurveyAnswerOption, { type: 'radio', label: 'A' });
			const label = screen.container.querySelector('label');
			expect(label?.classList.contains('bg-surface')).toBe(true);
		});
	});

	describe('disabled state', () => {
		it('sets disabled attribute on the input', async () => {
			const screen = render(SurveyAnswerOption, {
				type: 'radio',
				label: 'A',
				disabled: true
			});
			const radio = screen.getByRole('radio');
			await expect.element(radio).toHaveAttribute('disabled');
		});

		it('applies opacity-50 when disabled', async () => {
			const screen = render(SurveyAnswerOption, {
				type: 'checkbox',
				label: 'B',
				disabled: true
			});
			const label = screen.container.querySelector('label');
			expect(label?.classList.contains('opacity-50')).toBe(true);
		});
	});

	describe('visual indicator', () => {
		it('renders radio indicator dot when type=radio and selected', async () => {
			const screen = render(SurveyAnswerOption, {
				type: 'radio',
				label: 'A',
				selected: true
			});
			// Radio selected state shows a filled circle (span with bg-primary)
			const dot = screen.container.querySelector('.bg-primary.rounded-full');
			expect(dot).not.toBeNull();
		});

		it('renders checkbox checkmark SVG when type=checkbox and selected', async () => {
			const screen = render(SurveyAnswerOption, {
				type: 'checkbox',
				label: 'A',
				selected: true
			});
			const svg = screen.container.querySelector('polyline');
			expect(svg).not.toBeNull();
		});

		it('does not render indicator when not selected', async () => {
			const screen = render(SurveyAnswerOption, { type: 'radio', label: 'A' });
			const dot = screen.container.querySelector('.bg-primary.rounded-full');
			expect(dot).toBeNull();
		});
	});
});
