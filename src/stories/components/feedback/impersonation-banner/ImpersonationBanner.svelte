<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import EyeIcon from 'phosphor-svelte/lib/Eye';

	interface Props {
		/** The user being impersonated. */
		userName: string;
		/** Ends the impersonation; rejects with a message safe to show. */
		onstop: () => Promise<void>;
	}

	let { userName, onstop }: Props = $props();

	let stopping = $state(false);
	let failure = $state<string | null>(null);

	async function stop() {
		stopping = true;
		failure = null;
		try {
			await onstop();
		} catch (e) {
			failure = e instanceof Error ? e.message : 'Could not stop impersonating. Sign out instead.';
			stopping = false;
		}
	}
</script>

<div
	role="status"
	class="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-warning px-4 py-2 text-sm text-on-warning print:hidden"
	style="padding-top: calc(0.5rem + env(safe-area-inset-top));"
>
	<p class="flex items-center gap-2">
		<EyeIcon class="size-4 shrink-0" weight="bold" />
		<span>You are signed in as <strong>{userName}</strong>. Changes you make are made for them and recorded.</span>
	</p>
	<Button size="sm" variant="outline" loading={stopping} onclick={stop} class="border-on-warning text-on-warning">
		Stop impersonating
	</Button>
	{#if failure}<p class="w-full text-center">{failure}</p>{/if}
</div>
