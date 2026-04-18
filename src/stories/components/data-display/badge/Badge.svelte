<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Small pill label for status, categories, and location visit states. */
	interface Props {
		/** Color scheme. Location variants map directly to canvassing contact states. @default 'default' */
		variant?:
			| 'default'
			| 'primary'
			| 'secondary'
			| 'success'
			| 'warning'
			| 'error'
			| 'info'
			| 'location-unvisited'
			| 'location-contacted'
			| 'location-no-contact'
			| 'location-hostile';
		/** Display size. @default 'md' */
		size?: 'sm' | 'md';
		children: Snippet;
		[key: string]: unknown;
	}

	let { variant = 'default', size = 'md', children, ...props }: Props = $props();

	const variantClasses: Record<string, string> = {
		default: 'bg-surface-container text-on-surface border border-outline',
		primary: 'bg-primary text-on-primary',
		secondary: 'bg-secondary-container text-on-secondary-container',
		success: 'bg-success-container text-on-success-container',
		warning: 'bg-warning-container text-on-warning-container',
		error: 'bg-error-container text-on-error-container',
		info: 'bg-info-container text-on-info-container',
		'location-unvisited': 'bg-location-unvisited text-on-location-unvisited',
		'location-contacted': 'bg-location-contacted text-on-location-contacted',
		'location-no-contact': 'bg-location-no-contact text-on-location-no-contact',
		'location-hostile': 'bg-location-hostile text-on-location-hostile'
	};

	const sizeClasses: Record<string, string> = {
		sm: 'text-xs px-2 py-0.5 gap-1 [&>svg]:size-3',
		md: 'text-sm px-3 py-0.5 gap-1 [&>svg]:size-3.5'
	};
</script>

<span
	class="inline-flex items-center rounded-full font-medium {variantClasses[variant]} {sizeClasses[
		size
	]}"
	{...props}
>
	{@render children()}
</span>
