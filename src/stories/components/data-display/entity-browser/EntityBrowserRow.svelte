<script lang="ts">
	import type { Component } from 'svelte';

	interface Props {
		name: string;
		date: string | Date;
		href: string;
		icon?: Component;
	}

	const { name, date, href, icon: Icon }: Props = $props();

	const formattedDate = $derived(() => {
		const d = typeof date === 'string' ? new Date(date) : date;
		const now = new Date();
		const isToday = d.toDateString() === now.toDateString();
		const isThisYear = d.getFullYear() === now.getFullYear();

		if (isToday) {
			return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
		}
		if (isThisYear) {
			return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		}
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	});
</script>

<a
	{href}
	class="flex items-center gap-4 px-4 py-3 border-b border-outline-subtle hover:bg-surface-container transition-colors duration-100 group"
>
	<div class="w-8 h-8 shrink-0 flex items-center justify-center text-on-surface-subtle [&>svg]:size-5">
		{#if Icon}
			<Icon />
		{/if}
	</div>
	<span class="flex-1 text-sm text-on-surface truncate group-hover:text-primary transition-colors">{name}</span>
	<span class="text-sm text-on-surface-subtle w-36 shrink-0 text-right">{formattedDate()}</span>
</a>
