<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SurveyScreen from './SurveyScreen.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Survey/SurveyScreen',
		component: SurveyScreen,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle:
					'The full survey screen shown when a canvasser opens a turf location. Mobile-optimized with large touch targets and scannable text.'
			}
		}
	});

	const sampleLocation = {
		location_name: "Sabina's Yummy Tacos",
		street: '742 Germantown Ave',
		locality: 'Philadelphia',
		region: 'PA',
		postcode: '19104'
	};

	type QuestionType = 'radio' | 'check' | 'text';

	const sampleQuestions: {
		db_id: string;
		type: QuestionType;
		text: string;
		choices: string[];
		index: number;
		response: string;
	}[] = [
		{
			db_id: 'q1',
			type: 'radio',
			text: 'How do you feel about the proposed park renovation?',
			choices: ['Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Strongly disagree'],
			index: 0,
			response: ''
		},
		{
			db_id: 'q2',
			type: 'check',
			text: 'Which outreach methods have been most effective in your area?',
			choices: [
				'Door-to-door canvassing',
				'Community events',
				'Social media',
				'Phone banking',
				'Yard signs'
			],
			index: 1,
			response: ''
		},
		{
			db_id: 'q3',
			type: 'text',
			text: 'What concerns do you have about the neighborhood?',
			choices: [],
			index: 2,
			response: ''
		}
	];

	const prefilledQuestions: typeof sampleQuestions = [
		{
			db_id: 'q1',
			type: 'radio',
			text: 'How do you feel about the proposed park renovation?',
			choices: ['Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Strongly disagree'],
			index: 0,
			response: 'Agree'
		},
		{
			db_id: 'q2',
			type: 'check',
			text: 'Which outreach methods have been most effective in your area?',
			choices: [
				'Door-to-door canvassing',
				'Community events',
				'Social media',
				'Phone banking',
				'Yard signs'
			],
			index: 1,
			response: 'Community events,Social media'
		},
		{
			db_id: 'q3',
			type: 'text',
			text: 'What concerns do you have about the neighborhood?',
			choices: [],
			index: 2,
			response: 'Traffic and noise from the new construction site have been a major issue.'
		}
	];

	function noop() {}
</script>

<Story name="With Questions" asChild>
	<SurveyScreen
		location={sampleLocation}
		questions={sampleQuestions}
		contactMade={true}
		backHref="#"
		onSubmit={noop}
	/>
</Story>

<Story name="With Pre-filled Responses" asChild>
	<SurveyScreen
		location={sampleLocation}
		questions={prefilledQuestions}
		contactMade={true}
		attemptNote="Resident was friendly and interested in volunteering."
		backHref="#"
		onSubmit={noop}
	/>
</Story>

<Story name="Contact Not Made" asChild>
	<SurveyScreen
		location={sampleLocation}
		questions={sampleQuestions}
		contactMade={false}
		backHref="#"
		onSubmit={noop}
	/>
</Story>

<Story name="No Questions" asChild>
	<SurveyScreen
		location={sampleLocation}
		questions={[]}
		contactMade={true}
		backHref="#"
		onSubmit={noop}
	/>
</Story>
