<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SurveyAnswerOption from './SurveyAnswerOption.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/SurveyAnswerOption',
		component: SurveyAnswerOption,
		tags: ['autodocs'],
		argTypes: {
			type: {
				control: { type: 'radio' },
				options: ['radio', 'checkbox'],
				description: 'The input type: radio for single-select, checkbox for multi-select.'
			},
			label: {
				control: 'text',
				description: 'The display text for this answer option.'
			},
			selected: {
				control: 'boolean',
				description: 'Whether this option is currently selected.'
			},
			disabled: {
				control: 'boolean',
				description: 'Whether this option is non-interactive.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					'A large, mobile-optimized tappable answer option for survey questions. Designed for field use with 56px touch targets.'
			}
		}
	});
</script>

<Story name="Radio Unselected" args={{ type: 'radio', label: 'Strongly agree' }} />

<Story name="Radio Selected" args={{ type: 'radio', label: 'Strongly agree', selected: true }} />

<Story name="Checkbox Unselected" args={{ type: 'checkbox', label: 'Community events' }} />

<Story
	name="Checkbox Selected"
	args={{ type: 'checkbox', label: 'Community events', selected: true }}
/>

<Story
	name="Disabled"
	args={{ type: 'radio', label: 'Strongly agree', selected: true, disabled: true }}
/>

<Story name="Multiple Radio Options" asChild>
	<div class="flex flex-col gap-2 max-w-md">
		<SurveyAnswerOption type="radio" label="Strongly agree" name="demo" />
		<SurveyAnswerOption type="radio" label="Agree" name="demo" selected />
		<SurveyAnswerOption type="radio" label="Neutral" name="demo" />
		<SurveyAnswerOption type="radio" label="Disagree" name="demo" />
		<SurveyAnswerOption type="radio" label="Strongly disagree" name="demo" />
	</div>
</Story>

<Story name="Multiple Checkbox Options" asChild>
	<div class="flex flex-col gap-2 max-w-md">
		<SurveyAnswerOption type="checkbox" label="Door-to-door canvassing" selected />
		<SurveyAnswerOption type="checkbox" label="Community events" />
		<SurveyAnswerOption type="checkbox" label="Social media" selected />
		<SurveyAnswerOption type="checkbox" label="Phone banking" />
	</div>
</Story>
