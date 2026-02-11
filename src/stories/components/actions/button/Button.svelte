<script lang="ts">
	import { Button } from 'bits-ui'
	import SpinnerGapIcon from 'phosphor-svelte/lib/SpinnerGapIcon'
	import { dev } from '$app/environment'
	import type { Snippet } from 'svelte'

	type Variant = 'primary' | 'outline' | 'ghost' | 'destructive'
	type ButtonType = 'button' | 'submit' | 'reset'

	interface Props {
		children: Snippet
		variant?: Variant
		type?: ButtonType
		href?: string
		disabled?: boolean
		loading?: boolean
		iconOnly?: boolean
		'aria-label'?: string
		class?: string
		[key: string]: unknown
	}

	let {
		children,
		variant = 'primary',
		type = 'button',
		href,
		disabled = false,
		loading = false,
		iconOnly = false,
		'aria-label': ariaLabel,
		class: className = '',
		...restProps
	}: Props = $props()

	let loadingGuard = $derived(
		loading && !disabled ? { onclick: (e: MouseEvent) => e.preventDefault() } : {}
	)

	if (dev) {
		$effect(() => {
			if (iconOnly && !ariaLabel) {
				console.warn(
					'[Button] Icon-only buttons require an `aria-label` prop for accessibility.'
				)
			}
		})
	}

	const variantClasses: Record<Variant, string> = {
		primary: 'bg-primary text-on-primary hover:bg-primary/90 active:bg-primary/80',
		outline:
			'border border-outline bg-transparent text-on-surface hover:bg-surface-container active:bg-surface-container-high',
		ghost: 'bg-transparent text-on-surface hover:bg-surface-container active:bg-surface-container-high',
		destructive:
			'bg-error text-on-error hover:bg-error/90 active:bg-error/80 focus-visible:outline-error'
	}

	const baseClasses =
		'h-12 md:h-10 min-w-12 md:min-w-10 [&>svg]:size-5 no-underline inline-flex items-center justify-center gap-2 rounded-lg text-sm cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2'

	let computedClass = $derived(
		[
			baseClasses,
			variantClasses[variant],
			iconOnly ? 'p-2' : 'px-4 py-2',
			disabled ? 'opacity-50' : '',
			disabled || loading ? 'pointer-events-none' : '',
			className
		]
			.filter(Boolean)
			.join(' ')
	)
</script>

{#snippet content()}
	{#if loading}
		<SpinnerGapIcon class="animate-spin" aria-hidden="true" />
	{/if}
	{@render children()}
{/snippet}

{#if href && !disabled}
	<Button.Root
		{href}
		aria-disabled={loading || undefined}
		aria-busy={loading || undefined}
		aria-label={ariaLabel}
		class={computedClass}
		{...restProps}
		{...loadingGuard}
	>
		{@render content()}
	</Button.Root>
{:else}
	<Button.Root
		{type}
		disabled={disabled || undefined}
		aria-disabled={loading && !disabled ? true : undefined}
		aria-busy={loading || undefined}
		aria-label={ariaLabel}
		class={computedClass}
		{...restProps}
		{...loadingGuard}
	>
		{@render content()}
	</Button.Root>
{/if}
