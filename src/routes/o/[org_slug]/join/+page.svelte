<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import JoinTurf from '$pages/join/JoinTurf.svelte';

	const orgSlug = $derived($page.params.org_slug);

	async function handleJoin(code: string) {
		const res = await fetch('/api/turf/resolve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ code })
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(text || 'Invalid code.');
		}

		const data = await res.json();

		if (data.organizationSlug !== orgSlug) {
			throw new Error('Invalid code.');
		}

		goto(`/o/${orgSlug}/map/${data.turfId}`);
	}
</script>

<JoinTurf onJoin={handleJoin} />
