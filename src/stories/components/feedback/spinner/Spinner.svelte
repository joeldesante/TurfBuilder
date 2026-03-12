<script lang="ts">
	import SpinnerGapIcon from 'phosphor-svelte/lib/SpinnerGapIcon';

	interface Props {
		size?: number;
		class?: string;
	}

	let { size = 20, class: className = '' }: Props = $props();
</script>

<SpinnerGapIcon {size} class="animate-spin {className}" aria-hidden="true" />
