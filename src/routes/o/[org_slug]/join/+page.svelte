<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import JoinTurf from '$pages/join/JoinTurf.svelte';

	const orgSlug = $derived($page.params.org_slug);

	async function handleJoin(code: string) {
		const res = await fetch(`/o/${orgSlug}/join`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ code })
		});

		if (!res.ok) {
			const data = await res.json();
			throw new Error(data.error || 'Invalid code.');
		}

		const data = await res.json();
		goto(`/o/${orgSlug}/map/${data.id}`);
	}
</script>

<JoinTurf onJoin={handleJoin} />
