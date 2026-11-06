<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import Button from '$components/actions/button/Button.svelte';
	import UserMenu from '$components/actions/user-menu/UserMenu.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import { authClient } from '$lib/client';
	import { pageLoader } from '$lib/client/page-loader.svelte';
	import { CameraIcon, PlusIcon, QrCodeIcon, UsersThreeIcon } from 'phosphor-svelte';

	interface Props {
		allowCreation?: boolean;
		/** The signed-in user's name; its initials fill the account menu avatar. */
		name?: string;
		/** The signed-in user's email. With `onsignout`, adds the account menu in the top right. */
		email?: string;
		onsignout?: () => void | Promise<void>;
		onSelect: (org: any) => void | Promise<void>;
		/** How long the organizations may take before the full-screen loader comes up. */
		loaderDelayMs?: number;
	}

	const FADE_MS = 200;

	const {
		allowCreation = false,
		name,
		email,
		onsignout,
		onSelect,
		loaderDelayMs = 200
	}: Props = $props();
	const organizations = authClient.useListOrganizations();
	// Organizations deleted from the infra panel stay in the table but not here.
	const visibleOrgs = $derived(
		($organizations.data ?? []).filter((org) => !(org as { deletedAt?: unknown }).deletedAt)
	);

	// Two-line buttons: a short intent, then what it does. The default button height is fixed.
	const choiceClass = 'w-full text-center h-auto! md:h-auto! py-3!';

	// The root layout's loader is shared with the navigation into an org, so there is only ever one.
	// It comes up only if the organizations are still loading after loaderDelayMs, so a cached list
	// shows at once. Once up, the logo stays for a moment so it never blinks.
	let raisedLoader = false;

	// The floating + on phones opens a small menu: create an organization (if allowed) or join one.
	let addMenuOpen = $state(false);
	let addMenuEl: HTMLElement | undefined = $state();

	// Anywhere outside the + and its options closes the menu; Escape does too.
	function closeAddMenuOnOutsidePress(event: PointerEvent) {
		if (addMenuOpen && addMenuEl && !addMenuEl.contains(event.target as Node)) addMenuOpen = false;
	}
	function closeAddMenuOnEscape(event: KeyboardEvent) {
		if (event.key === 'Escape') addMenuOpen = false;
	}

	// Client only: the loader is a module singleton, which would leak between requests on the server.
	let checkedForLoader = false;
	$effect(() => {
		// A loader already up when this page mounted (raised on sign-in, before the redirect) is this
		// page's to put away once the organizations are here, so the list never fills in under it.
		if (!checkedForLoader) {
			checkedForLoader = true;
			if (untrack(() => pageLoader.active)) raisedLoader = true;
		}
		if (!$organizations.isPending) {
			if (raisedLoader) pageLoader.hide();
			raisedLoader = false;
			return;
		}
		if (raisedLoader) return;
		const timer = setTimeout(() => {
			pageLoader.show({ logoMinMs: 700 });
			raisedLoader = true;
		}, loaderDelayMs);
		return () => clearTimeout(timer);
	});

	// Leaving while still loading must not leave the cover up.
	onDestroy(() => {
		if (raisedLoader) pageLoader.hide();
	});
</script>

{#snippet accountMenu()}
	{#if email && onsignout}
		<UserMenu {name} {email} {onsignout} />
	{/if}
{/snippet}

{#snippet choice(title: string, description: string)}
	<span class="flex flex-col items-center gap-0.5 leading-tight">
		<span class="text-base">{title}</span>
		<span class="text-sm font-normal opacity-80">{description}</span>
	</span>
{/snippet}

<svelte:window onpointerdown={closeAddMenuOnOutsidePress} onkeydown={closeAddMenuOnEscape} />

{#if $organizations.isPending}
	<!-- Nothing to show until the loader has faded out. -->
{:else if $organizations.error}
	<!-- A failed request is not the same as having no organizations, so never offer join or create. -->
	<div class="relative min-h-dvh flex items-center justify-center p-6" in:fade={{ duration: FADE_MS }}>
		<div class="absolute top-4 right-4">{@render accountMenu()}</div>
		<div class="flex flex-col items-center gap-2 text-center max-w-sm" role="alert">
			<h1 class="text-2xl font-bold text-on-surface">Something went wrong</h1>
			<p class="text-lg text-on-surface-subtle">
				<span class="block">Your organizations failed to load.</span>
				<span class="block">Reload the page or try again later.</span>
			</p>
		</div>
	</div>
{:else if visibleOrgs.length}
	<div class="px-4" in:fade={{ duration: FADE_MS }}>
		<div>
			<!-- pt-3 puts the row's centre 32px down, level with the account menu on the join pages. -->
			<PageHeader title="Select Organization" class="pt-3! lg:pt-3!">
				{#snippet actions()}
					{#if allowCreation}
						<!-- Phones get the floating + below instead. -->
						<div class="hidden md:block">
							<Button variant="outline" href="/orgs/create">
								<PlusIcon />
								Start a New Movement
							</Button>
						</div>
					{/if}
					{@render accountMenu()}
				{/snippet}
				<!-- TODO: Bring back the QR scanner and join buttons here once the join page has been added. -->
			</PageHeader>
		</div>

		<div class="flex flex-col lg:flex-row gap-3 lg:gap-3">
			{#each visibleOrgs as organization}
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
		</div>

		<!-- Phones: one floating + that opens the ways to get into another organization. -->
		<div
			bind:this={addMenuEl}
			class="md:hidden fixed bottom-6 right-4 z-40 flex flex-col items-end gap-3"
		>
			{#if addMenuOpen}
				<div
					id="add-organization-menu"
					class="flex flex-col gap-2 items-stretch"
					transition:fade={{ duration: 120 }}
				>
					{#if allowCreation}
						<Button variant="outline" href="/orgs/create" class="shadow-lg bg-surface!">
							Create an organization
						</Button>
					{/if}
					<Button variant="outline" href="/orgs/join" class="shadow-lg bg-surface!">
						Join an organization
					</Button>
				</div>
			{/if}
			<Button
				iconOnly
				aria-label={addMenuOpen ? 'Close menu' : 'Create or join an organization'}
				aria-expanded={addMenuOpen}
				aria-controls="add-organization-menu"
				onclick={() => (addMenuOpen = !addMenuOpen)}
				class="rounded-full! size-14! shadow-lg"
			>
				<!-- A plus turned a quarter of the way round is an X, so one icon eases between the two. -->
				<span
					class="flex transition-transform duration-200 ease-out motion-reduce:transition-none"
					class:rotate-45={addMenuOpen}
				>
					<PlusIcon size={24} />
				</span>
			</Button>
		</div>
	</div>
{:else}
	<div
		class="relative min-h-dvh flex items-center justify-center p-6"
		in:fade={{ duration: FADE_MS }}
	>
		<div class="absolute top-4 right-4">{@render accountMenu()}</div>
		<div class="flex flex-col items-center gap-10 w-full max-w-sm select-none">
			<div class="flex flex-col items-center gap-2 text-center">
				<h1 class="text-6xl sm:text-7xl font-bold tracking-tight text-on-surface">Welcome</h1>
				<p class="text-lg text-on-surface-subtle">You are not yet in an organization.</p>
			</div>
			<div class="flex flex-col items-stretch gap-3 w-full">
				<Button href="/orgs/join" class={choiceClass}>
					{@render choice("I'm here to canvass", 'Join an existing organization')}
				</Button>
				{#if allowCreation}
					<Button variant="outline" href="/orgs/create" class={choiceClass}>
						{@render choice("I'm here to build", 'Start your own organization')}
					</Button>
				{/if}
			</div>
		</div>
	</div>
{/if}
