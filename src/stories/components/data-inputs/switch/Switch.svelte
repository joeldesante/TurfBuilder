<script lang="ts">
	import type { Snippet } from 'svelte'
	import { getContext } from 'svelte'
	import { Switch as SwitchPrimitive } from 'bits-ui'

	interface Props {
		checked?: boolean
		onCheckedChange?: (checked: boolean) => void
		disabled?: boolean
		name?: string
		value?: string
		id?: string
		children?: Snippet
		class?: string
		[key: string]: unknown
	}

	let {
		checked = $bindable(false),
		onCheckedChange,
		disabled = false,
		name,
		value,
		id,
		children,
		class: className = '',
		...restProps
	}: Props = $props()

	const ctx = getContext<
		| {
				id: string
				invalid: boolean
				disabled: boolean
				describedBy: string | undefined
			}
		| undefined
	>('formField')

	let switchId = $derived(id ?? ctx?.id)
	let isInvalid = $derived(ctx?.invalid ?? false)
	let isDisabled = $derived(disabled || (ctx?.disabled ?? false))
	let describedBy = $derived(ctx?.describedBy)

	let trackClass = $derived(
		[
			'inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-transparent',
			'transition-colors duration-150',
			'focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-1',
			'disabled:opacity-50 disabled:cursor-not-allowed',
			'data-[state=checked]:bg-primary data-[state=unchecked]:bg-surface-container-highest',
			isInvalid ? 'ring-2 ring-error' : '',
			className
		]
			.filter(Boolean)
			.join(' ')
	)
</script>

{#if children}
	<div class="inline-flex items-center gap-3">
		<SwitchPrimitive.Root
			id={switchId}
			bind:checked
			{onCheckedChange}
			disabled={isDisabled}
			{name}
			{value}
			aria-invalid={isInvalid || undefined}
			aria-describedby={describedBy}
			class={trackClass}
			{...restProps}
		>
			<SwitchPrimitive.Thumb
				class="pointer-events-none block size-5 rounded-full bg-on-primary shadow-sm ring-0 transition-transform duration-150 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5"
			/>
		</SwitchPrimitive.Root>
		<label
			for={switchId}
			class={[
				'text-sm text-on-surface select-none',
				isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
			]
				.filter(Boolean)
				.join(' ')}
		>
			{@render children()}
		</label>
	</div>
{:else}
	<SwitchPrimitive.Root
		id={switchId}
		bind:checked
		{onCheckedChange}
		disabled={isDisabled}
		{name}
		{value}
		aria-invalid={isInvalid || undefined}
		aria-describedby={describedBy}
		class={trackClass}
		{...restProps}
	>
		<SwitchPrimitive.Thumb
			class="pointer-events-none block size-5 rounded-full bg-on-primary shadow-sm ring-0 transition-transform duration-150 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5"
		/>
	</SwitchPrimitive.Root>
{/if}
