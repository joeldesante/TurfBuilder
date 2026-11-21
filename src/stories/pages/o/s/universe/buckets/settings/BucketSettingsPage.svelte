<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Button from '$components/actions/button/Button.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import ConfirmDialog from '$components/feedback/confirm-dialog/ConfirmDialog.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';

	interface Props {
		bucketName: string;
		/** Saves the new name. Reject with a message fit to show the user. */
		onRename: (name: string) => Promise<void>;
		/** Deletes the bucket. Reject with a message fit to show the user. */
		onDelete: () => Promise<void>;
	}

	const { bucketName, onRename, onDelete }: Props = $props();

	/** The name the bucket holds. It moves when a rename goes through. */
	let savedName = $state(untrack(() => bucketName));
	let name = $state(untrack(() => bucketName));
	let renaming = $state(false);

	let confirmingDelete = $state(false);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);

	const trimmed = $derived(name.trim());
	const canRename = $derived(trimmed !== '' && trimmed !== savedName && !renaming);

	async function rename(event: SubmitEvent) {
		event.preventDefault();
		if (!canRename) return;
		renaming = true;
		try {
			await onRename(trimmed);
			savedName = trimmed;
			name = trimmed;
			toast.success('Bucket renamed.');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'The bucket could not be renamed.');
		} finally {
			renaming = false;
		}
	}

	function askToDelete() {
		deleteError = null;
		confirmingDelete = true;
	}

	async function confirmDelete() {
		deleting = true;
		deleteError = null;
		try {
			await onDelete();
			confirmingDelete = false;
		} catch (e) {
			deleteError = e instanceof Error ? e.message : 'The bucket could not be deleted.';
		} finally {
			deleting = false;
		}
	}
</script>

<div>
	<PageHeader title="Settings" subheading={savedName} />

	<div class="flex max-w-2xl flex-col gap-10">
		<section aria-labelledby="rename-heading" class="flex flex-col gap-3">
			<h2 id="rename-heading" class="text-base font-semibold text-on-surface">Name</h2>
			<form class="flex flex-wrap items-end gap-3" onsubmit={rename}>
				<div class="flex min-w-64 flex-1 flex-col gap-1.5">
					<label for="bucket-name" class="text-sm font-medium text-on-surface">Bucket name</label>
					<TextInput id="bucket-name" bind:value={name} maxlength={255} />
				</div>
				<Button type="submit" disabled={!canRename} loading={renaming}>Save Name</Button>
			</form>
		</section>

		<section
			aria-labelledby="delete-heading"
			class="flex flex-col gap-3 rounded-lg border border-error p-4"
		>
			<h2 id="delete-heading" class="text-base font-semibold text-on-surface">Delete bucket</h2>
			<p class="text-sm text-on-surface-subtle">
				Deleting a bucket removes it from the sidebar and from search. Its lists, surveys, scripts
				and turfs are kept, but you can no longer open them through the bucket.
			</p>
			<div>
				<Button variant="destructive" onclick={askToDelete}>Delete Bucket</Button>
			</div>
		</section>
	</div>
</div>

<ConfirmDialog
	open={confirmingDelete}
	title="Delete this bucket?"
	description="{savedName} will disappear from the sidebar and from search. Its lists, surveys, scripts and turfs are kept."
	confirmLabel="Delete Bucket"
	destructive
	loading={deleting}
	error={deleteError}
	onConfirm={confirmDelete}
	onCancel={() => (confirmingDelete = false)}
/>
