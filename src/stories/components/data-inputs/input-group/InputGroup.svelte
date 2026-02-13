<script lang="ts">
	import type { Snippet } from 'svelte'
	import { getContext } from 'svelte'

	interface Props {
		leading?: Snippet
		trailing?: Snippet
		disabled?: boolean
		children: Snippet
		class?: string
		[key: string]: unknown
	}

	let {
		leading,
		trailing,
		disabled = false,
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

	let isInvalid = $derived(ctx?.invalid ?? false)
	let isDisabled = $derived(disabled || (ctx?.disabled ?? false))

	let computedClass = $derived(
		[
			'flex items-center rounded-md border',
			'has-[:focus]:outline-2 has-[:focus]:outline-primary has-[:focus]:-outline-offset-1',
			isDisabled && 'opacity-50 cursor-not-allowed',
			isInvalid ? 'border-error' : 'border-outline',
			className
		]
			.filter(Boolean)
			.join(' ')
	)
</script>

<div class={computedClass} {...restProps}>
	{#if leading}
		<span class="flex items-center pl-3 text-on-surface-subtle shrink-0">
			{@render leading()}
		</span>
	{/if}

	{@render children()}

	{#if trailing}
		<span class="flex items-center pr-3 text-on-surface-subtle shrink-0">
			{@render trailing()}
		</span>
	{/if}
</div>
