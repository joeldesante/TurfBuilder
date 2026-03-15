<script lang="ts">
	import { goto } from '$app/navigation';
	import JoinTurf from '$pages/join/JoinTurf.svelte';

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
		goto(`/o/${data.organizationSlug}/map/${data.turfId}`);
	}
</script>

<JoinTurf onJoin={handleJoin} />
