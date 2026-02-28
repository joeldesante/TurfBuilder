<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SurveyQuestion from './SurveyQuestion.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/SurveyQuestion',
		component: SurveyQuestion,
		tags: ['autodocs'],
		argTypes: {
			questionNumber: {
				control: 'number',
				description: 'The display number for this question.'
			},
			questionText: {
				control: 'text',
				description: 'The question text to display.'
			},
			questionType: {
				control: { type: 'inline-radio' },
				options: ['radio', 'check', 'text'],
				description: 'The type of input to render for answers.'
			},
			choices: {
				control: 'object',
				description: 'Array of choice strings for radio/check question types.'
			},
			value: {
				control: 'text',
				description:
					'The current response value. For checkbox, comma-separated. This is a bindable prop.'
			},
			disabled: {
				control: 'boolean',
				description: 'Disables all inputs for readonly/view mode.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					'A complete survey question with numbered header and mobile-optimized answer inputs. Supports radio, checkbox, and free-text question types.'
			}
		}
	});

	const likertChoices = ['Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Strongly disagree'];

	const outreachChoices = [
		'Door-to-door canvassing',
		'Community events',
		'Social media',
		'Phone banking',
		'Yard signs'
	];
</script>

<Story
	name="Radio"
	args={{
		questionNumber: 1,
		questionText: 'How do you feel about the proposed park renovation?',
		questionType: 'radio',
		choices: likertChoices
	}}
/>

<Story
	name="Radio With Selection"
	args={{
		questionNumber: 1,
		questionText: 'How do you feel about the proposed park renovation?',
		questionType: 'radio',
		choices: likertChoices,
		value: 'Agree'
	}}
/>

<Story
	name="Radio Disabled"
	args={{
		questionNumber: 1,
		questionText: 'How do you feel about the proposed park renovation?',
		questionType: 'radio',
		choices: likertChoices,
		value: 'Agree',
		disabled: true
	}}
/>

<Story
	name="Checkbox"
	args={{
		questionNumber: 2,
		questionText: 'Which outreach methods have been most effective in your area?',
		questionType: 'check',
		choices: outreachChoices
	}}
/>

<Story
	name="Checkbox With Selections"
	args={{
		questionNumber: 2,
		questionText: 'Which outreach methods have been most effective in your area?',
		questionType: 'check',
		choices: outreachChoices,
		value: 'Community events,Social media'
	}}
/>

<Story
	name="Checkbox Disabled"
	args={{
		questionNumber: 2,
		questionText: 'Which outreach methods have been most effective in your area?',
		questionType: 'check',
		choices: outreachChoices,
		value: 'Community events,Social media',
		disabled: true
	}}
/>

<Story
	name="Text"
	args={{
		questionNumber: 3,
		questionText: 'What concerns do you have about the neighborhood?',
		questionType: 'text'
	}}
/>

<Story
	name="Text With Value"
	args={{
		questionNumber: 3,
		questionText: 'What concerns do you have about the neighborhood?',
		questionType: 'text',
		value: 'Traffic and noise from the new construction site have been a major issue.'
	}}
/>

<Story
	name="Text Disabled"
	args={{
		questionNumber: 3,
		questionText: 'What concerns do you have about the neighborhood?',
		questionType: 'text',
		value: 'Traffic and noise from the new construction site have been a major issue.',
		disabled: true
	}}
/>
