<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import { authClient } from '$lib/client';
	import { CameraIcon, QrCodeIcon, UsersThreeIcon } from 'phosphor-svelte';

	interface Props {
		allowCreation?: boolean;
		onSelect: (org: any) => void;
	}

	const { allowCreation = false, onSelect }: Props = $props();
	const organizations = authClient.useListOrganizations();
</script>

<div class="px-4">
	<div>
		<PageHeader title="Select Organization">
			<!-- TODO: Bring back when QR Scanner is added and the join page has been added...
			{#snippet actions()}
				<Button variant="ghost" iconOnly aria-label="Scan a QR code to join an organization.">
					<QrCodeIcon />
				</Button>
				<Button variant="ghost" iconOnly aria-label="Join an organization.">
					<UsersThreeIcon />
				</Button>
			{/snippet}
		-->
		</PageHeader>
	</div>

	<div class="flex flex-col lg:flex-row gap-3 lg:gap-3">
		{#if $organizations.isPending}
			<p>Loading...</p>
		{:else if !$organizations.data?.length}
			<div class="w-full h-32 flex justify-center items-center">
				<div class="flex flex-col items-center justify-center">
					<p class="font-semibold">You haven't joined an organization yet.</p>
					<!-- Change this to a join org button once the join page or search page has been created...-->
					<p class="text-sm">Contact your organization to get an invitation link!</p>
				</div>
			</div>
		{:else}
			{#each $organizations.data as organization}
				<div
					class="flex items-center gap-4 p-4 border lg:aspect-1 rounded-sm cursor-pointer transition-colors hover:bg-surface-container-high hover:border-primary active:bg-surface-container-high active:border-primary"
					role="button"
					tabindex="0"
					onclick={() => onSelect(organization)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							onSelect(organization);
						}
					}}
				>
					<UsersThreeIcon size={22} />
					<p class="text-lg font-bold truncate">{organization.name}</p>
				</div>
			{/each}
		{/if}

		{#if allowCreation}
			<a href="/orgs/create" class="text-sm text-center text-muted hover:underline mt-2">
				Create a new organization
			</a>
		{/if}
	</div>
</div>
