<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import UsersIcon from 'phosphor-svelte/lib/Users';
	import DatabaseIcon from 'phosphor-svelte/lib/Database';
	import GearIcon from 'phosphor-svelte/lib/Gear';
	import ShieldCheckIcon from 'phosphor-svelte/lib/ShieldCheck';

	interface Capability {
		permission: string;
		label: string;
		description: string;
		href: string;
		icon: typeof UsersIcon;
	}

	interface Props {
		infraPermissions: string[];
	}

	const { infraPermissions }: Props = $props();

	const capabilities: Capability[] = [
		{
			permission: 'users.manage',
			label: 'User Management',
			description: 'Grant and revoke infrastructure permissions for other users.',
			href: '/infra/users',
			icon: UsersIcon
		},
		{
			permission: 'locations.overture_sync',
			label: 'Overture Data Sync',
			description: 'Trigger a sync of global location data from Overture Maps.',
			href: '/infra/sync',
			icon: DatabaseIcon
		},
		{
			permission: 'settings.manage',
			label: 'System Settings',
			description: 'Configure system-wide settings such as organization creation.',
			href: '/infra/settings',
			icon: GearIcon
		}
	];

	const available = $derived(capabilities.filter((c) => infraPermissions.includes(c.permission)));
	const unavailable = $derived(capabilities.filter((c) => !infraPermissions.includes(c.permission)));
</script>

<PageHeader
	title="Infrastructure"
	subheading="Internal tools and system management. Not visible to organization users."
/>

<div class="space-y-8">
	<section>
		<h2 class="text-sm font-medium text-on-surface-subtle uppercase tracking-wide mb-3">
			Your permissions
		</h2>
		<div class="flex flex-wrap gap-2">
			{#each infraPermissions as permission}
				<span
					class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary"
				>
					<ShieldCheckIcon size={12} weight="fill" />
					{permission}
				</span>
			{:else}
				<p class="text-sm text-on-surface-subtle">No infrastructure permissions assigned.</p>
			{/each}
		</div>
	</section>

	{#if available.length > 0}
		<section>
			<h2 class="text-sm font-medium text-on-surface-subtle uppercase tracking-wide mb-3">
				Tools
			</h2>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each available as cap}
					<a
						href={cap.href}
						class="group block p-4 rounded-xl border border-outline-subtle bg-surface-container-low
							   hover:border-primary hover:bg-surface-container transition-colors duration-150 no-underline"
					>
						<div class="flex items-start gap-3">
							<div class="mt-0.5 text-primary">
								<cap.icon size={20} />
							</div>
							<div>
								<p class="text-sm font-medium text-on-surface">{cap.label}</p>
								<p class="mt-1 text-xs text-on-surface-subtle">{cap.description}</p>
							</div>
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	{#if unavailable.length > 0}
		<section>
			<h2 class="text-sm font-medium text-on-surface-subtle uppercase tracking-wide mb-3">
				Restricted tools
			</h2>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each unavailable as cap}
					<div
						class="block p-4 rounded-xl border border-outline-subtle bg-surface-container-lowest opacity-50"
					>
						<div class="flex items-start gap-3">
							<div class="mt-0.5 text-on-surface-subtle">
								<cap.icon size={20} />
							</div>
							<div>
								<p class="text-sm font-medium text-on-surface">{cap.label}</p>
								<p class="mt-1 text-xs text-on-surface-subtle">{cap.description}</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>
