<script lang="ts">
	import { getContext } from 'svelte';
	import { DatePicker } from 'bits-ui';
	import type { DateValue } from '@internationalized/date';
	import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank';
	import CaretLeft from 'phosphor-svelte/lib/CaretLeft';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';

	interface Props {
		value?: DateValue;
		placeholder?: DateValue;
		minValue?: DateValue;
		maxValue?: DateValue;
		disabled?: boolean;
		readonly?: boolean;
		required?: boolean;
		name?: string;
		id?: string;
		granularity?: 'day' | 'hour' | 'minute' | 'second';
		locale?: string;
		closeOnDateSelect?: boolean;
		weekdayFormat?: 'narrow' | 'short' | 'long';
		fixedWeeks?: boolean;
		onValueChange?: (value: DateValue | undefined) => void;
		class?: string;
		[key: string]: unknown;
	}

	let {
		value = $bindable(),
		placeholder,
		minValue,
		maxValue,
		disabled = false,
		readonly = false,
		required = false,
		name,
		id,
		granularity = 'day',
		locale = 'en',
		closeOnDateSelect = true,
		weekdayFormat = 'short',
		fixedWeeks = false,
		onValueChange,
		class: className = '',
		...restProps
	}: Props = $props();

	const ctx = getContext<
		| {
				id: string;
				invalid: boolean;
				disabled: boolean;
				describedBy: string | undefined;
		  }
		| undefined
	>('formField');

	let fieldId = $derived(id ?? ctx?.id);
	let isInvalid = $derived(ctx?.invalid ?? false);
	let isDisabled = $derived(disabled || (ctx?.disabled ?? false));
	let describedBy = $derived(ctx?.describedBy);

	let inputClass = $derived(
		[
			'flex items-center w-full h-12 md:h-10 px-3 rounded-lg border bg-surface cursor-text',
			'text-sm text-on-surface select-none',
			'has-[:focus]:outline-2 has-[:focus]:outline-offset-2',
			isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
			isInvalid
				? 'border-error has-[:focus]:outline-error'
				: 'border-outline has-[:focus]:outline-primary',
			className
		]
			.filter(Boolean)
			.join(' ')
	);

	const editableSegmentClass =
		'rounded px-1 py-0.5 text-on-surface aria-[valuetext=Empty]:text-on-surface-subtle data-[active]:bg-primary data-[active]:text-on-primary focus-visible:outline-none ![caret-color:currentColor]';
	const literalSegmentClass = 'text-on-surface-subtle px-0.5';

	const dayClass =
		'inline-flex size-9 md:size-8 w-full h-full items-center justify-center rounded-md text-sm font-normal transition-colors ' +
		'text-on-surface hover:bg-surface-container-high ' +
		'data-[selected]:bg-primary data-[selected]:text-on-primary data-[selected]:hover:bg-primary ' +
		'data-[today]:font-semibold data-[today]:ring-1 data-[today]:ring-primary ' +
		'data-[disabled]:opacity-40 data-[disabled]:pointer-events-none ' +
		'data-[unavailable]:line-through data-[unavailable]:text-on-surface/40 ' +
		'data-[outside-month]:text-on-surface/30 data-[outside-month]:pointer-events-none';
</script>

<DatePicker.Root
	bind:value
	{placeholder}
	{minValue}
	{maxValue}
	disabled={isDisabled}
	{readonly}
	{required}
	{granularity}
	{locale}
	{closeOnDateSelect}
	{weekdayFormat}
	{fixedWeeks}
	{onValueChange}
	errorMessageId={describedBy}
	{...restProps}
>
	<DatePicker.Input id={fieldId} {name} class={inputClass}>
		{#snippet children({ segments })}
			{#each segments as { part, value: segValue }, i (part + i)}
				{#if part === 'literal'}
					<DatePicker.Segment {part} class={literalSegmentClass}>
						{segValue}
					</DatePicker.Segment>
				{:else}
					<DatePicker.Segment {part} class={editableSegmentClass}>
						{segValue}
					</DatePicker.Segment>
				{/if}
			{/each}
			<DatePicker.Trigger
				class="ml-auto inline-flex size-8 items-center justify-center rounded-md text-on-surface/60 hover:bg-surface-container-high hover:text-on-surface transition-colors [&>svg]:size-5"
			>
				<CalendarBlank />
			</DatePicker.Trigger>
		{/snippet}
	</DatePicker.Input>

	<DatePicker.Content
		sideOffset={6}
		class="z-50 rounded-xl border border-outline bg-surface-container shadow-lg p-4"
	>
		<DatePicker.Calendar>
			{#snippet children({ months, weekdays })}
				<DatePicker.Header class="flex items-center justify-between mb-3">
					<DatePicker.PrevButton
						class="inline-flex size-9 md:size-8 items-center justify-center rounded-md text-on-surface hover:bg-surface-container-high transition-colors [&>svg]:size-4"
					>
						<CaretLeft />
					</DatePicker.PrevButton>
					<DatePicker.Heading class="text-sm font-semibold text-on-surface" />
					<DatePicker.NextButton
						class="inline-flex size-9 md:size-8 items-center justify-center rounded-md text-on-surface hover:bg-surface-container-high transition-colors [&>svg]:size-4"
					>
						<CaretRight />
					</DatePicker.NextButton>
				</DatePicker.Header>
				{#each months as month (month.value)}
					<DatePicker.Grid class="w-full border-collapse">
						<DatePicker.GridHead>
							<DatePicker.GridRow class="flex w-full justify-between mb-1">
								{#each weekdays as day (day)}
									<DatePicker.HeadCell
										class="w-10 text-center text-xs font-normal text-on-surface-subtle pb-1"
									>
										{day}
									</DatePicker.HeadCell>
								{/each}
							</DatePicker.GridRow>
						</DatePicker.GridHead>
						<DatePicker.GridBody>
							{#each month.weeks as weekDates (weekDates)}
								<DatePicker.GridRow class="flex w-full">
									{#each weekDates as date (date)}
										<DatePicker.Cell
											{date}
											month={month.value}
											class="relative size-10 p-0 text-center"
										>
											<DatePicker.Day class={dayClass} />
										</DatePicker.Cell>
									{/each}
								</DatePicker.GridRow>
							{/each}
						</DatePicker.GridBody>
					</DatePicker.Grid>
				{/each}
			{/snippet}
		</DatePicker.Calendar>
	</DatePicker.Content>
</DatePicker.Root>
