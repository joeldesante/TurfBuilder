<script lang="ts">
	import Badge from '$components/data-display/badge/Badge.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import type { Alert } from './AlertFeedPage.svelte';

	interface Props {
		alerts: Alert[];
		onPublish?: (alert: Omit<Alert, 'id' | 'publishedAt'>) => Promise<void>;
		onDelete?: (id: string) => Promise<void>;
	}

	const {
		alerts: initialAlerts,
		onPublish = async () => {},
		onDelete = async () => {}
	}: Props = $props();

	let alerts = $state<Alert[]>([...initialAlerts]);
	let title = $state('');
	let body = $state('');
	let category = $state<Alert['category']>('info');
	let publishing = $state(false);
	let deletingId = $state<string | null>(null);

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

	async function handlePublish() {
		if (!title.trim() || !body.trim()) return;
		publishing = true;
		try {
			await onPublish({ title: title.trim(), body: body.trim(), category, author: 'You' });
			alerts = [
				{
					id: crypto.randomUUID(),
					title: title.trim(),
					body: body.trim(),
					category,
					author: 'You',
					publishedAt: new Date().toISOString()
				},
				...alerts
			];
			title = '';
			body = '';
			category = 'info';
		} finally {
			publishing = false;
		}
	}

	async function handleDelete(id: string) {
		deletingId = id;
		try {
			await onDelete(id);
			alerts = alerts.filter((a) => a.id !== id);
		} finally {
			deletingId = null;
		}
	}
</script>

<PageHeader title="Alert Feed" subheading="Publish alerts to your canvassers in the field." />

<div class="p-6 max-w-2xl space-y-6">
	<!-- Compose -->
	<div class="rounded-lg border border-outline p-5 space-y-4">
		<p class="font-medium text-on-surface">Publish a new alert</p>

		<div class="space-y-1">
			<label for="alert-title" class="text-sm text-on-surface-variant">Title</label>
			<input
				id="alert-title"
				type="text"
				placeholder="Alert title"
				bind:value={title}
				class="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-subtle focus:outline-none focus:ring-2 focus:ring-primary"
			/>
		</div>

		<div class="space-y-1">
			<label for="alert-body" class="text-sm text-on-surface-variant">Message</label>
			<textarea
				id="alert-body"
				rows="3"
				placeholder="Write your alert message..."
				bind:value={body}
				class="w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-subtle focus:outline-none focus:ring-2 focus:ring-primary resize-none"
			></textarea>
		</div>

		<div class="space-y-1">
			<label for="alert-category" class="text-sm text-on-surface-variant">Category</label>
			<select
				id="alert-category"
				bind:value={category}
				class="rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
			>
				<option value="info">Info</option>
				<option value="update">Update</option>
				<option value="urgent">Urgent</option>
			</select>
		</div>

		<div class="flex justify-end">
			<Button
				variant="primary"
				loading={publishing}
				disabled={!title.trim() || !body.trim()}
				onclick={handlePublish}
			>
				Publish Alert
			</Button>
		</div>
	</div>

	<!-- Feed -->
	<div class="space-y-3">
		{#each alerts as alert (alert.id)}
			<div class="rounded-lg border border-outline p-4 space-y-2">
				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center gap-2">
						<Badge variant={categoryVariant[alert.category]}>{categoryLabel[alert.category]}</Badge>
						<span class="text-xs text-on-surface-subtle">{relativeTime(alert.publishedAt)}</span>
					</div>
					<Button
						variant="ghost"
						size="sm"
						loading={deletingId === alert.id}
						onclick={() => handleDelete(alert.id)}
					>
						Delete
					</Button>
				</div>
				<p class="font-semibold text-on-surface">{alert.title}</p>
				<p class="text-sm text-on-surface-variant leading-relaxed">{alert.body}</p>
				<p class="text-xs text-on-surface-subtle">— {alert.author}</p>
			</div>
		{:else}
			<p class="text-on-surface-subtle text-sm py-8 text-center">
				No alerts have been published yet.
			</p>
		{/each}
	</div>
</div>
