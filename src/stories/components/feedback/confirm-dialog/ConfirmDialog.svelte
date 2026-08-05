<script lang="ts" module>
	export interface Props {
		open: boolean;
		title: string;
		/** Body copy. Say what will happen and whether it can be undone. */
		description?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		/** Styles the confirm button as destructive. */
		destructive?: boolean;
		/** Set while the confirm action is in flight. */
		loading?: boolean;
		/** Surfaced above the buttons when the action fails. */
		error?: string | null;
		onConfirm: () => void;
		onCancel: () => void;
		children?: Snippet;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import Button from '$components/actions/button/Button.svelte';
	import WarningIcon from 'phosphor-svelte/lib/Warning';

	const {
		open,
		title,
		description,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		destructive = false,
		loading = false,
		error = null,
		onConfirm,
		onCancel,
		children
	}: Props = $props();
</script>

<Dialog.Root
	{open}
	onOpenChange={(next) => {
		if (!next) onCancel();
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-6 shadow-lg"
		>
			<div class="flex gap-3">
				{#if destructive}
					<div
						class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-error-container text-on-error-container"
					>
						<WarningIcon size={20} weight="fill" />
					</div>
				{/if}
				<div class="min-w-0 flex-1">
					<Dialog.Title class="text-lg font-semibold text-on-surface">{title}</Dialog.Title>
					{#if description}
						<Dialog.Description class="mt-1 text-sm text-on-surface-variant">
							{description}
						</Dialog.Description>
					{/if}
					{#if children}
						<div class="mt-3">{@render children()}</div>
					{/if}
				</div>
			</div>

			{#if error}
				<p role="alert" class="mt-4 text-sm text-error">{error}</p>
			{/if}

			<div class="mt-6 flex justify-end gap-2">
				<Button variant="ghost" onclick={onCancel} disabled={loading}>{cancelLabel}</Button>
				<Button variant={destructive ? 'destructive' : 'primary'} onclick={onConfirm} {loading}>
					{confirmLabel}
				</Button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
