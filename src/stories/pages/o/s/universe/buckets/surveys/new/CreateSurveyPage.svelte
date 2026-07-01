<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';

	interface Props {
		onCreate: (name: string) => Promise<void>;
	}

	const { onCreate }: Props = $props();

	let name = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			await onCreate(name);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create survey.';
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
		&larr; Back
	</button>

	<PageHeader title="New Survey" />

	<form onsubmit={handleSubmit} class="flex flex-col gap-4 mt-6">
		<div class="flex flex-col gap-1">
			<label for="survey-name" class="text-sm font-medium">Name</label>
			<input
				id="survey-name"
				type="text"
				bind:value={name}
				placeholder="Door Knock Survey"
				required
				class="border rounded px-3 py-2"
			/>
		</div>

		{#if error}
			<p class="text-sm text-red-600" role="alert">{error}</p>
		{/if}

		<Button type="submit" disabled={loading || !name.trim()}>
			{loading ? 'Creating…' : 'Create Survey'}
		</Button>
	</form>
</div>
