<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import StepLayout from './StepLayout.svelte';

	interface Props {
		onSingle: () => void;
		onMulti: () => void;
	}

	const { onSingle, onMulti }: Props = $props();
</script>

<StepLayout
	title="Tenancy Mode"
	description="Choose whether this installation is for one group or shared by many."
>
	<div class="flex flex-col gap-1.5">
		<Button class="w-full" onclick={onSingle}>Single tenant</Button>
		<p class="text-sm text-on-surface-subtle">
			One organization uses this installation. Best for a single campaign or team.
		</p>
	</div>
	<div class="flex flex-col gap-1.5">
		<Button class="w-full" onclick={onMulti}>Multi tenant</Button>
		<p class="text-sm text-on-surface-subtle">
			Several independent organizations share this installation, each with their own members and
			data.
		</p>
	</div>
</StepLayout>
