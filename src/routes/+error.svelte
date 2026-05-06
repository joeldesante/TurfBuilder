<script>
	import { page } from '$app/state'; // Use '$app/stores' in older SvelteKit versions
	import Spinner from '$components/feedback/spinner/Spinner.svelte';

	let imageLoaded = $state(false);
</script>

<div class="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
	<h1 class="text-5xl font-bold text-on-surface">{page.status}</h1>
	<p class="text-lg text-on-surface-subtle max-w-sm">{page.error?.message}</p>
	<button
		class="text-sm text-primary underline"
		onclick={() => {
			history.back();
			window.addEventListener('pageshow', () => location.reload(), { once: true });
		}}>Go back</button
	>

	{#if page.data.config?.cat_gifs_enabled !== false}
		{#if !imageLoaded}
			<div class="flex flex-row items-center gap-2 mt-2">
				<Spinner size={16} />
				<span class="text-sm text-on-surface-subtle">Loading Cat GIF</span>
			</div>
		{/if}
		<img
			src="https://cataas.com/cat/gif?width=200"
			alt="A cut cat"
			class="w-[200px] h-auto rounded-lg mt-2"
			class:hidden={!imageLoaded}
			onload={() => (imageLoaded = true)}
		/>
		<small class="text-xs text-on-surface-subtle leading-[1.5]"
			>See an inappropriate GIF? Or, are you seeing this page in error?
			<a href="https://github.com/joeldesante/TurfBuilder/issues" target="_blank"
				>Please let us know</a
			>.<br />Cat images brought to you by
			<a href="https://cataas.com" target="_blank">Cat-As-A-Service</a>.</small
		>
	{/if}
</div>
