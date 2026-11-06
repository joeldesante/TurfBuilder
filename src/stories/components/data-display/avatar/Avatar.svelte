<script lang="ts">
	type Variant = 'default' | 'primary';

	interface Props {
		username: string;
		size?: 'sm' | 'md' | 'lg';
		variant?: Variant;
		class?: string;
		[key: string]: unknown;
	}

	let {
		username,
		size = 'md',
		variant = 'default',
		class: className = '',
		...restProps
	}: Props = $props();

	const variantClasses: Record<Variant, string> = {
		default: 'bg-surface-container-high text-on-surface',
		primary: 'bg-primary-container text-on-primary-container'
	};

	const sizeClasses: Record<string, string> = {
		sm: 'size-8 text-xs',
		md: 'size-10 text-sm',
		lg: 'size-12 text-base'
	};

	// The first letter is always a capital, whatever case the name was typed in.
	let initials = $derived.by(() => {
		const letters = username.trim().slice(0, 2);
		return letters.charAt(0).toUpperCase() + letters.slice(1);
	});

	let computedClass = $derived(
		[
			'inline-flex items-center justify-center rounded-full font-semibold select-none shrink-0',
			variantClasses[variant],
			sizeClasses[size],
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<span class={computedClass} role="img" aria-label={username} {...restProps}>
	{initials}
</span>
