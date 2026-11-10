<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StepIndicator from './StepIndicator.svelte';

	const { Story } = defineMeta({
		title: 'Components/Layout/Step Indicator',
		component: StepIndicator,
		tags: ['autodocs'],
		args: {
			steps: ['What kind of organization is this?', 'What does your organization do?', 'Name it'],
			current: 0
		},
		argTypes: {
			current: { control: { type: 'number', min: 0 } }
		}
	});
</script>

<Story name="First step" />

<Story name="Middle step" args={{ current: 1 }} />

<Story name="Last step" args={{ current: 2 }} />
