<script lang="ts">
	import type { Snippet } from 'svelte'

	interface Props {
		variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
		size?: 'sm' | 'md'
		children: Snippet
		[key: string]: unknown
	}

	let { variant = 'default', size = 'md', children, ...props }: Props = $props()

	const variantClasses: Record<string, string> = {
		default: 'bg-surface-container text-on-surface border border-outline',
		primary: 'bg-primary text-on-primary',
		secondary: 'bg-secondary-container text-on-secondary-container',
		success: 'bg-success-container text-on-success-container',
		warning: 'bg-warning-container text-on-warning-container',
		error: 'bg-error-container text-on-error-container',
		info: 'bg-info-container text-on-info-container'
	}

	const sizeClasses: Record<string, string> = {
		sm: 'text-xs px-2 py-0.5 gap-1 [&>svg]:size-3',
		md: 'text-sm px-3 py-0.5 gap-1 [&>svg]:size-3.5'
	}
</script>

<span
	class="inline-flex items-center rounded-full font-medium {variantClasses[variant]} {sizeClasses[size]}"
	{...props}
>
	{@render children()}
</span>
