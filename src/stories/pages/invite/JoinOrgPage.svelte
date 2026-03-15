<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';

	interface Props {
		orgName: string;
		orgSlug: string;
		alreadyMember: boolean;
	}

	const { orgName, orgSlug, alreadyMember }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center min-h-[60vh] p-6">
	<div class="w-full max-w-md space-y-6">
		<PageHeader title={orgName} subheading="You've been invited to join this organization." />

		{#if alreadyMember}
			<div class="rounded-lg border border-outline bg-surface-container p-6 text-center space-y-3">
				<p class="text-on-surface text-sm">You're already a member of <strong>{orgName}</strong>.</p>
				<a
					href="/o/{orgSlug}"
					class="inline-flex items-center justify-center h-10 px-4 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors"
				>
					Go to {orgName}
				</a>
			</div>
		{:else}
			<div class="rounded-lg border border-outline bg-surface-container p-6 space-y-4">
				<p class="text-on-surface-subtle text-sm">
					Click below to join <strong>{orgName}</strong> as a member.
				</p>
				<form method="POST" action="?/join">
					<Button type="submit" class="w-full">Join {orgName}</Button>
				</form>
			</div>
		{/if}
	</div>
</div>
