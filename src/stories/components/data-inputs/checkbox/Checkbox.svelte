<script lang="ts">
	import { Checkbox } from 'bits-ui'
	import Check from 'phosphor-svelte/lib/Check'

	interface Props {
		label?: string
		supportingText?: string
		showLabel?: boolean
		checked?: boolean
		disabled?: boolean
		onCheckedChange?: (checked: boolean) => void
	}

	let {
		label = '',
		supportingText = '',
		showLabel = true,
		checked = $bindable(false),
		disabled = false,
		onCheckedChange
	}: Props = $props()

	const id = `checkbox-${Math.random().toString(36).slice(2, 9)}`
</script>

<div class="flex items-start gap-3">
	<Checkbox.Root
		{id}
		bind:checked
		{disabled}
		{onCheckedChange}
		class="mt-0.5 h-5 w-5 shrink-0 rounded border border-outline bg-surface flex items-center justify-center
			data-[state=checked]:bg-primary data-[state=checked]:border-primary
			data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed
			focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
			transition-colors"
	>
		{#snippet children({ checked: isChecked })}
			{#if isChecked}
				<Check class="h-3.5 w-3.5 text-on-primary" weight="bold" />
			{/if}
		{/snippet}
	</Checkbox.Root>
	{#if showLabel && label}
		<div class="flex flex-col gap-0.5">
			<label
				for={id}
				class="text-on-surface select-none {disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
			>
				{label}
			</label>
			{#if supportingText}
				<span class="text-sm text-on-surface-subtle {disabled ? 'opacity-50' : ''}">
					{supportingText}
				</span>
			{/if}
		</div>
	{/if}
</div>
