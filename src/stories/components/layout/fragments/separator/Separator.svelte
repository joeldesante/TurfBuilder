<script lang="ts">
	import { Separator } from 'bits-ui';

	interface Props {
		orientation?: 'horizontal' | 'vertical';
		decorative?: boolean;
	}

	const { orientation = 'horizontal', decorative = true }: Props = $props();
</script>

<Separator.Root
	{orientation}
	{decorative}
	class="bg-outline-subtle shrink-0 data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-[1px]"
/>
