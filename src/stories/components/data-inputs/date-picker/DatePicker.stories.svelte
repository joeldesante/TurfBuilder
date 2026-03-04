<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { CalendarDate, today, getLocalTimeZone } from '@internationalized/date';
	import DatePicker from './DatePicker.svelte';
	import FormField from '../form-field/FormField.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/DatePicker',
		component: DatePicker,
		tags: ['autodocs'],
		argTypes: {
			value: {
				control: false,
				description: 'The selected date value. Bindable.'
			},
			placeholder: {
				control: false,
				description:
					'A date that determines the calendar view when no value is selected. Granularity is inferred from the placeholder type.'
			},
			minValue: {
				control: false,
				description: 'The earliest selectable date. Dates before this are disabled.'
			},
			maxValue: {
				control: false,
				description: 'The latest selectable date. Dates after this are disabled.'
			},
			disabled: {
				control: 'boolean',
				description:
					'Whether the date picker is disabled. Can also be inherited from a parent FormField.'
			},
			readonly: {
				control: 'boolean',
				description: 'Whether the date picker is read-only.'
			},
			required: {
				control: 'boolean',
				description: 'Whether a date selection is required.'
			},
			granularity: {
				control: { type: 'select' },
				options: ['day', 'hour', 'minute', 'second'],
				description: 'Controls which date/time segments are rendered.'
			},
			weekdayFormat: {
				control: { type: 'radio' },
				options: ['narrow', 'short', 'long'],
				description: 'Format for weekday header labels in the calendar.'
			},
			fixedWeeks: {
				control: 'boolean',
				description: 'Always display 6 weeks in the calendar, even if some rows are empty.'
			},
			closeOnDateSelect: {
				control: 'boolean',
				description: 'Whether the calendar popover closes automatically after selecting a date.'
			},
			id: {
				control: false,
				table: { category: 'Derived Props' },
				description: 'The id attribute. Auto-inherited from FormField context if not provided.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					'A segmented date input with calendar popover. Nest within FormField for labels, helper text, and validation.'
			}
		}
	});
</script>

<Story name="Default" />

<Story name="With Value" asChild>
	<DatePicker value={new CalendarDate(2026, 3, 15)} />
</Story>

<Story name="With FormField" asChild>
	<FormField label="Event Date" helperText="Select the date of your canvassing event.">
		<DatePicker />
	</FormField>
</Story>

<Story name="Required with FormField" asChild>
	<FormField label="Event Date" requirementIndicator="required">
		<DatePicker required />
	</FormField>
</Story>

<Story name="With Min/Max" asChild>
	<FormField label="Event Date" helperText="Only dates within the next 90 days are available.">
		<DatePicker
			minValue={today(getLocalTimeZone())}
			maxValue={today(getLocalTimeZone()).add({ days: 90 })}
		/>
	</FormField>
</Story>

<Story name="With Errors" asChild>
	<FormField label="Event Date" errors={['Please select a date.']} dirty={true}>
		<DatePicker />
	</FormField>
</Story>

<Story name="Disabled" args={{ disabled: true }} />

<Story name="Disabled with FormField" asChild>
	<FormField label="Event Date" disabled={true}>
		<DatePicker />
	</FormField>
</Story>
