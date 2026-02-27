<script lang="ts">
	type OptionType = 'radio' | 'checkbox';

	interface Props {
		type: OptionType;
		label: string;
		selected?: boolean;
		disabled?: boolean;
		name?: string;
		value?: string;
		onchange?: (e: Event) => void;
		class?: string;
		[key: string]: unknown;
	}

	let {
		type,
		label,
		selected = false,
		disabled = false,
		name,
		value,
		onchange,
		class: className = '',
		...restProps
	}: Props = $props();

	let computedClass = $derived(
		[
			'flex items-center gap-3 w-full min-h-14 md:min-h-12 px-4 py-3 rounded-lg border cursor-pointer transition-colors duration-150 select-none',
			selected
				? 'bg-primary-container border-primary'
				: 'bg-surface border-outline hover:bg-surface-container',
			disabled ? 'opacity-50 cursor-not-allowed' : '',
			className
		]
			.filter(Boolean)
			.join(' ')
	);

	let indicatorClass = $derived(
		[
			'shrink-0 inline-flex items-center justify-center border transition-colors duration-150',
			type === 'radio' ? 'size-6 md:size-5 rounded-full' : 'size-6 md:size-5 rounded-md',
			selected ? 'border-primary' : 'border-outline',
		type === 'checkbox' && selected ? 'bg-primary' : ''
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<label class={computedClass} {...restProps}>
	<input {type} {name} {value} checked={selected} {disabled} {onchange} class="sr-only" />

	<span class={indicatorClass} aria-hidden="true">
		{#if type === 'radio' && selected}
			<span class="size-3 md:size-2.5 rounded-full bg-primary"></span>
		{:else if type === 'checkbox' && selected}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="text-white"
			>
				<polyline points="20 6 9 17 4 12" />
			</svg>
		{/if}
	</span>

	<span class="text-base text-on-surface">{label}</span>
</label>
