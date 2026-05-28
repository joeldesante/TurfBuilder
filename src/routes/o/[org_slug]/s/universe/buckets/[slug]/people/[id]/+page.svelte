<script lang="ts">
	import { page } from '$app/stores';
	import PersonProfilePage from '$pages/universe/bucket/person-profile-page/PersonProfilePage.svelte';

	const { data } = $props();

	const backHref = `/o/${$page.params.org_slug}/s/universe/buckets/${$page.params.slug}/people`;
</script>

<PersonProfilePage person={data.person} {backHref} />
