<script lang="ts">
	import Badge from '$components/data-display/badge/Badge.svelte';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';

	export interface Alert {
		id: string;
		title: string;
		body: string;
		category: 'urgent' | 'info' | 'update';
		author: string;
		publishedAt: string;
	}

	interface Props {
		alerts: Alert[];
	}

	const { alerts }: Props = $props();

	const categoryVariant: Record<Alert['category'], 'error' | 'info' | 'warning'> = {
		urgent: 'error',
		info: 'info',
		update: 'warning'
	};

	const categoryLabel: Record<Alert['category'], string> = {
		urgent: 'Urgent',
		info: 'Info',
		update: 'Update'
	};

	function relativeTime(iso: string): string {
		const diff = Date.now() - new Date(iso).getTime();
		const minutes = Math.floor(diff / 60_000);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}
</script>

<PageHeader title="Alert Feed" subheading="Stay up to date with the latest updates from your organizers." />

<div class="p-6 max-w-2xl space-y-3">
	{#each alerts as alert (alert.id)}
		<div class="rounded-lg border border-outline p-4 space-y-2">
			<div class="flex items-center gap-2">
				<Badge variant={categoryVariant[alert.category]}>{categoryLabel[alert.category]}</Badge>
				<span class="text-xs text-on-surface-subtle">{relativeTime(alert.publishedAt)}</span>
			</div>
			<p class="font-semibold text-on-surface">{alert.title}</p>
			<p class="text-sm text-on-surface-variant leading-relaxed">{alert.body}</p>
			<p class="text-xs text-on-surface-subtle">— {alert.author}</p>
		</div>
	{:else}
		<p class="text-on-surface-subtle text-sm py-8 text-center">No alerts have been published.</p>
	{/each}
</div>
