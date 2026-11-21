<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	/**
	 * Renders one snippet with one argument. Lets imperative code, such as a map
	 * popup that `mount()`s its own content, show a snippet a parent passed in.
	 */
	interface Props {
		snippet: Snippet<[T]>;
		arg: T;
	}

	let { snippet, arg }: Props = $props();
</script>

{@render snippet(arg)}
