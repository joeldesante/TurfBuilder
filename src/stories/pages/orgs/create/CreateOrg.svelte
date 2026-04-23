<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';

	interface Props {
		onCreate: (name: string, slug: string) => Promise<void>;
	}

	const { onCreate }: Props = $props();

	let name = $state('');
	let slug = $state('');
	let error = $state('');
	let loading = $state(false);

	function deriveSlug(value: string) {
		return value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function onNameInput(e: Event) {
		name = (e.target as HTMLInputElement).value;
		slug = deriveSlug(name);
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			await onCreate(name, slug);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create organization.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="max-w-md mx-auto pt-16 px-4">
	<button
		type="button"
		onclick={() => history.back()}
		class="flex items-center gap-1 text-sm text-on-surface-subtle hover:text-on-surface transition-colors mb-6"
	>
		← Back
	</button>

	<PageHeader title="Create Organization" />

	<form onsubmit={handleSubmit} class="flex flex-col gap-4 mt-6">
		<div class="flex flex-col gap-1">
			<label for="org-name" class="text-sm font-medium">Name</label>
			<input
				id="org-name"
				type="text"
				value={name}
				oninput={onNameInput}
				placeholder="North West Philly Alliance"
				required
				class="border rounded px-3 py-2"
			/>
		</div>

		<div class="flex flex-col gap-1">
			<label for="org-slug" class="text-sm font-medium">Slug</label>
			<input
				id="org-slug"
				type="text"
				bind:value={slug}
				placeholder="north-west-philly-alliance"
				required
				pattern="[a-z0-9\-]+"
				class="border rounded px-3 py-2 font-mono text-sm"
			/>
			<p class="text-xs text-muted">Used in URLs: /o/{slug || 'your-org'}/</p>
		</div>

		{#if error}
			<p class="text-sm text-red-600" role="alert">{error}</p>
		{/if}

		<Button type="submit" disabled={loading}>
			{loading ? 'Creating…' : 'Create Organization'}
		</Button>
	</form>
</div>
