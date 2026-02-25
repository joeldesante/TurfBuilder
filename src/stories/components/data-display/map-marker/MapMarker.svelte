<script lang="ts">
	import type { Component } from 'svelte';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import { SmileyAngryIcon } from 'phosphor-svelte';

	export type Variant = 'unvisited' | 'contacted' | 'no-contact' | 'hostile'

	interface Props {
		variant?: Variant
		isSelected?: boolean
		class?: string
		[key: string]: unknown
	}

	let { variant = 'unvisited', isSelected = false, class: className = '', ...restProps }: Props =
		$props()

	const variantFillClasses: Record<Variant, string> = {
		unvisited: 'fill-location-unvisited',
		contacted: 'fill-location-contacted',
		'no-contact': 'fill-location-no-contact',
		hostile: 'fill-location-hostile'
	}

	const variantIconColorClasses: Record<Variant, string> = {
		unvisited: 'text-on-location-unvisited',
		contacted: 'text-on-location-contacted',
		'no-contact': 'text-on-location-no-contact',
		hostile: 'text-on-location-hostile'
	}

	const variantIcons: Record<Variant, Component | null> = {
		unvisited: null,
		contacted: CheckCircleIcon,
		'no-contact': null,
		hostile: SmileyAngryIcon
	}

	let icon = $derived(variantIcons[variant])
	let fillClass = $derived(variantFillClasses[variant])
	let iconColorClass = $derived(variantIconColorClasses[variant])

	let computedClass = $derived(
		[
			'relative inline-block w-6 h-8 cursor-pointer transition-transform duration-200 origin-bottom',
			isSelected ? 'scale-125' : 'scale-100',
			className
		]
			.filter(Boolean)
			.join(' ')
	)
</script>

<div class={computedClass} role="img" aria-label="{variant} location marker" {...restProps}>
	<svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" class="w-full h-full drop-shadow-sm">
		<!-- Pin shape: circle head at top, pointed tail at bottom -->
		<path
			d="M12 0C5.373 0 0 5.373 0 12c0 6.627 12 20 12 20S24 18.627 24 12C24 5.373 18.627 0 12 0z"
			class={fillClass}
		/>
		<!-- Icon centered inside the white circle via foreignObject -->
		{#if icon}
			{@const Icon = icon}
			<foreignObject x="4" y="4" width="16" height="16">
				<div
					xmlns="http://www.w3.org/1999/xhtml"
					class="w-full h-full flex items-center justify-center {iconColorClass}"
				>
					<Icon size="16" />
				</div>
			</foreignObject>
		{/if}
	</svg>
</div>
