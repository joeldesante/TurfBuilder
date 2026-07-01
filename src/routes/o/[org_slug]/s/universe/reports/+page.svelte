<script lang="ts">
	import UniverseReportsPage from '$pages/o/s/universe/reports/UniverseReportsPage.svelte';
	import { page } from '$app/state';
</script>

<UniverseReportsPage orgSlug={page.params.org_slug} />
