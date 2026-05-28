<script lang="ts">
	import EntityDetailPage from '$pages/universe/entity-detail-page/EntityDetailPage.svelte';
	import type { PersonRecord, LocationRecord } from '$pages/universe/entity-detail-page/EntityDetailPage.svelte';

	const { data } = $props();
</script>

<EntityDetailPage
	orgSlug={data.organization.slug}
	entityType={data.entityType}
	entityId={data.entityId}
	record={data.record as PersonRecord | LocationRecord}
	isOutdated={data.isOutdated}
	backHref={data.backHref}
/>
