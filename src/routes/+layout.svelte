<script lang="ts">
	import '../app.css';
	import { CubeIcon } from 'phosphor-svelte';
	import { DropdownMenu } from 'bits-ui';
	import { authClient } from '$lib/client';
	import Avatar from '$components/data-display/avatar/Avatar.svelte';

	let { children, data } = $props();

	const session = authClient.useSession();

	let theme = $state<'system' | 'light' | 'dark'>('system');

	async function logout() {
		await authClient.signOut();
		location.href = '/auth/signin/';
	}
</script>

<svelte:head>
	<title>{data.config.application_name}</title>

	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content={data.config.application_name} />
	<link rel="apple-touch-icon" href={'/turf_builder_app_icon.png'} />
</svelte:head>

{#if process.env.NODE_ENV?.toLowerCase() !== 'production'}
	<div
		title="This instance is not runnning in production mode!"
		class="absolute bottom-0 right-0 rounded-full bg-orange-500 font-bold text-xs p-1 px-2 m-1 flex flex-row gap-1 items-center select-none shadow z-50"
	>
		<CubeIcon weight="fill" />
		DEV
	</div>
{/if}

{#if $session.data?.user.role === 'user'}
	<div class="fixed top-4 right-4 z-[9999]">
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				<Avatar
					username={$session.data.user.name ?? $session.data.user.email ?? '?'}
					variant="primary"
				/>
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align="end"
					side="bottom"
					sideOffset={8}
					class="z-50 min-w-48 rounded-lg border border-outline bg-surface p-1 shadow-md outline-none"
				>
					<div class="px-3 py-2">
						<p class="text-sm font-medium text-on-surface mb-2">Theme</p>
						{#each ['system', 'light', 'dark'] as option (option)}
							<label
								class="flex items-center gap-3 h-9 cursor-pointer text-sm text-on-surface"
							>
								<input
									type="radio"
									name="theme"
									value={option}
									bind:group={theme}
									class="accent-primary"
								/>
								{option.charAt(0).toUpperCase() + option.slice(1)}
							</label>
						{/each}
					</div>
					<DropdownMenu.Separator class="my-1 h-px bg-outline-subtle mx-1" />
					<DropdownMenu.Item
						onclick={logout}
						class="flex items-center px-3 h-9 w-full rounded-md text-sm cursor-pointer outline-none select-none text-on-surface data-[highlighted]:bg-surface-container-high"
					>
						Log out
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	</div>
{/if}

{@render children()}
