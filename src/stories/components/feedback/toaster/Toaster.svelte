<script lang="ts">
	import { Toaster as Sonner, type ToasterProps } from 'svelte-sonner';

	/**
	 * Shows toast notifications raised anywhere with `toast()`, `toast.error()` or
	 * `toast.success()` from `svelte-sonner`. Mounted once in the root layout, so
	 * pages only import `toast`. Styled with the app's theme tokens, so toasts
	 * follow light and dark mode. Any other svelte-sonner Toaster prop passes
	 * through.
	 */
	interface Props extends ToasterProps {
		/** Where the stack of toasts sits on screen. @default 'bottom-right' */
		position?: ToasterProps['position'];
		/** How long a toast stays up, in milliseconds. @default 6000 */
		duration?: number;
	}

	const { position = 'bottom-right', duration = 6000, ...rest }: Props = $props();
</script>

<Sonner
	{position}
	{duration}
	closeButton
	toastOptions={{
		unstyled: true,
		classes: {
			toast:
				'relative flex w-(--width) items-start gap-3 rounded-lg border border-outline-subtle bg-surface p-4 pr-10 text-sm text-on-surface shadow-md',
			content: 'flex flex-col gap-0.5',
			title: 'font-semibold',
			description: 'text-on-surface-subtle',
			icon: 'mt-0.5 shrink-0 [&>svg]:size-4',
			error: 'border-error/40 [&_[data-icon]]:text-error',
			success: '[&_[data-icon]]:text-primary',
			closeButton:
				'absolute right-2 top-2 rounded p-1 text-on-surface-subtle transition-colors hover:bg-surface-container hover:text-on-surface [&>svg]:size-3.5',
			actionButton: 'rounded-md bg-primary px-2 py-1 text-xs font-semibold text-on-primary',
			cancelButton: 'rounded-md border border-outline px-2 py-1 text-xs text-on-surface'
		}
	}}
	{...rest}
/>
