<script lang="ts">
	import { page } from '$app/stores';
	import PersonProfilePage from '$pages/universe/people/PersonProfilePage.svelte';

	const { data } = $props();

	const backHref = `/o/${$page.params.org_slug}/s/universe/search`;
</script>

<PersonProfilePage person={data.person} {backHref} />
