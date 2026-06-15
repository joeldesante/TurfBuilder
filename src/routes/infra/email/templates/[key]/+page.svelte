<script lang="ts">
	import InfraEmailTemplateEditorPage from '$pages/infra/email/InfraEmailTemplateEditorPage.svelte';
	const { data } = $props();

	async function onSave(subject: string, htmlBody: string) {
		const res = await fetch(`/infra/email/templates/${encodeURIComponent(data.templateKey)}/api`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ subject, html_body: htmlBody })
		});
		if (!res.ok) {
			const json = await res.json().catch(() => ({}));
			throw new Error(json.message ?? 'Failed to save template.');
		}
	}
</script>

<InfraEmailTemplateEditorPage
	templateKey={data.templateKey}
	subject={data.subject}
	htmlBody={data.htmlBody}
	variables={data.variables}
	updatedAt={data.updatedAt}
	{onSave}
/>
