<script lang="ts" module>
	/** Cookie remembering that the viewer closed the banner. Read on the server so it never renders. */
	export const BETA_BANNER_COOKIE = 'beta-banner-dismissed';
</script>

<script lang="ts">
	import XIcon from 'phosphor-svelte/lib/X';

	interface Props {
		/** Where questions are sent. */
		supportEmail?: string;
		/** Cookie name remembering that the viewer closed the banner. */
		storageKey?: string;
		/** Whether the viewer already closed it; decided on the server so the first paint is right. */
		dismissed?: boolean;
	}

	let {
		supportEmail = 'support@turfbuilder.org',
		storageKey = BETA_BANNER_COOKIE,
		dismissed: initiallyDismissed = false
	}: Props = $props();

	let closed = $state(false);

	function dismiss() {
		closed = true;
		// One year. The server reads this cookie, so a closed banner is never rendered.
		document.cookie = `${storageKey}=1; path=/; max-age=31536000; samesite=lax`;
	}
</script>

{#if !initiallyDismissed && !closed}
	<div
		role="status"
		class="flex items-center justify-center gap-3 bg-primary-container px-4 py-1.5 text-xs text-on-primary-container print:hidden"
	>
		<p class="text-center">
			TurfBuilder is in active early stage development. If you need help getting started or have
			questions about using the app, email
			<a href="mailto:{supportEmail}" class="text-inherit"
				><strong><u>{supportEmail}</u></strong></a
			>
		</p>
		<button
			type="button"
			aria-label="Close banner"
			class="shrink-0 rounded p-1 hover:bg-primary/15 focus-visible:outline-2"
			onclick={dismiss}
		>
			<XIcon class="size-3.5" weight="bold" />
		</button>
	</div>
{/if}
