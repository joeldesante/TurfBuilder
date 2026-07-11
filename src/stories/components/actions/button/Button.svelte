<script lang="ts">
	import { Button } from 'bits-ui';
	import SpinnerGapIcon from 'phosphor-svelte/lib/SpinnerGapIcon';
	import { dev } from '$app/environment';
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'outline' | 'ghost' | 'destructive';
	type ButtonType = 'button' | 'submit' | 'reset';
	type Size = 'default' | 'sm';
	type Weight = 'normal' | 'medium' | 'semibold' | 'bold';
	type TextSize = 'small' | 'normal' | 'large' | 'xl';

	/** Primary action element. Renders as a `<button>` or `<a>` depending on whether `href` is provided. */
	interface Props {
		children: Snippet;
		/** Visual style variant. @default 'primary' */
		variant?: Variant;
		/** Button size. @default 'default' */
		size?: Size;
		/** HTML button type attribute. @default 'button' */
		type?: ButtonType;
		/** When provided the button renders as an anchor tag. */
		href?: string;
		/** Disables interaction and reduces opacity. @default false */
		disabled?: boolean;
		/** Shows a spinner and blocks clicks without disabling the element. @default false */
		loading?: boolean;
		/** Set when the button contains only an icon — requires `aria-label` for accessibility. @default false */
		iconOnly?: boolean;
		/** Required when `iconOnly` is true. */
		'aria-label'?: string;
		/** Font weight of the button label. @default 'semibold' */
		weight?: Weight;
		/** Overrides the text size set by `size`. */
		textSize?: TextSize;
		/** Additional CSS classes. */
		class?: string;
		[key: string]: unknown;
	}

	let {
		children,
		variant = 'primary',
		size = 'default',
		type = 'button',
		href,
		disabled = false,
		loading = false,
		iconOnly = false,
		weight = 'semibold',
		textSize,
		'aria-label': ariaLabel,
		class: className = '',
		...restProps
	}: Props = $props();

	let loadingGuard = $derived(
		loading && !disabled ? { onclick: (e: MouseEvent) => e.preventDefault() } : {}
	);

	if (dev) {
		$effect(() => {
			if (iconOnly && !ariaLabel) {
				console.warn('[Button] Icon-only buttons require an `aria-label` prop for accessibility.');
			}
		});
	}

	const variantClasses: Record<Variant, string> = {
		primary: 'bg-primary text-on-primary hover:bg-primary/90 active:bg-primary/80',
		outline:
			'border border-outline bg-transparent text-on-surface hover:bg-surface-container active:bg-surface-container-high',
		ghost:
			'bg-transparent text-on-surface hover:bg-surface-container active:bg-surface-container-high',
		destructive:
			'bg-error text-on-error hover:bg-error/90 active:bg-error/80 focus-visible:outline-error'
	};

	const textSizeClasses: Record<TextSize, string> = {
		small: 'text-xs',
		normal: 'text-sm',
		large: 'text-base',
		xl: 'text-lg'
	};

	const weightClasses: Record<Weight, string> = {
		normal: 'font-normal',
		medium: 'font-medium',
		semibold: 'font-semibold',
		bold: 'font-bold'
	};

	const baseClasses =
		'no-underline inline-flex items-center justify-center rounded-sm cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 text-nowrap';

	const sizeClasses: Record<Size, string> = {
		default: 'h-12 md:h-10 min-w-12 md:min-w-10 [&>svg]:size-5 text-sm gap-2',
		sm: 'h-8 min-w-8 [&>svg]:size-4 text-sm gap-1.5'
	};

	const iconOnlyPadding: Record<Size, string> = {
		default: 'p-2',
		sm: 'p-1'
	};

	const defaultPadding: Record<Size, string> = {
		default: 'px-4 py-2',
		sm: 'px-3 py-1'
	};

	let computedClass = $derived(
		[
			baseClasses,
			weightClasses[weight],
			sizeClasses[size],
			textSize ? textSizeClasses[textSize] : '',
			variantClasses[variant],
			iconOnly ? iconOnlyPadding[size] : defaultPadding[size],
			disabled ? 'opacity-50' : '',
			disabled || loading ? 'pointer-events-none' : '',
			className
		]
			.filter(Boolean)
			.join(' ')
	);
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
