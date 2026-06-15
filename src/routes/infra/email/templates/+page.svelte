<script lang="ts">
	import InfraEmailTemplatesPage from '$pages/infra/email/InfraEmailTemplatesPage.svelte';
	const { data } = $props();
</script>

<InfraEmailTemplatesPage
	templates={data.templates}
	templateHref={(key) => `/infra/email/templates/${encodeURIComponent(key)}`}
/>
