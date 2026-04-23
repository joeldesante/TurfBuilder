<script lang="ts">
	import { authClient } from '$lib/client';
	import type { User } from 'better-auth';

	interface Props {
		user: User;
		allowCreation?: boolean;
	}

	const { user, allowCreation = false }: Props = $props();

	async function signOut() {
		await authClient.signOut();
		window.location.href = '/auth/signin';
	}
</script>

<div class="min-h-screen bg-surface flex items-center justify-center p-6">
	<div class="w-full max-w-md text-center">
		<h1 class="text-2xl font-semibold text-on-surface mb-2">
			You're not in an organization&nbsp;yet.
		</h1>
		<p class="text-on-surface-subtle mb-1">
			Signed in as <span class="font-medium text-on-surface">{user.email}</span>
		</p>
		<p class="text-on-surface-subtle text-sm mt-4 mb-8 max-w-sm mx-auto">
			Ask your organizer to invite you to their organization. Once you've been added, refresh this
			page or sign in again.
		</p>

		<div class="flex flex-col sm:flex-row gap-3 justify-center items-center">
			<button
				onclick={signOut}
				class="w-40 py-2.5 rounded-lg text-sm font-medium border border-outline text-on-surface hover:bg-surface-container transition-colors"
			>
				Sign Out
			</button>
		</div>

		{#if allowCreation}
			<div class="border-t border-outline-subtle mt-8 pt-8">
				<p class="text-on-surface-subtle text-sm mb-2">Starting a movement of your own?</p>
				<a href="/orgs/create" class="text-sm text-primary hover:underline">
					Create your own organization instead.
				</a>
			</div>
		{/if}
	</div>
</div>
