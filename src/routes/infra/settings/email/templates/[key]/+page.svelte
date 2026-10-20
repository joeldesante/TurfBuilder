<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { api } from '$lib/client/api';
	import InfraEmailTemplateEditorPage from '$pages/infra/settings/InfraEmailTemplateEditorPage.svelte';
	import type { EmailTemplateBody } from '$lib/shared/schemas/email-templates';

	const { data } = $props();

	const base = $derived(`/email-templates/${data.template.key}`);

	async function onsave(body: EmailTemplateBody) {
		await api(base, { method: 'PUT', body });
		await invalidateAll();
	}

	async function ontest(body: EmailTemplateBody) {
		const { to } = await api<{ to: string }>(`${base}/test-sends`, { method: 'POST', body });
		return `Sent a test email to ${to}.`;
	}

	async function onreset() {
		await api(`${base}/resets`, { method: 'POST' });
		await invalidateAll();
	}
</script>

<svelte:head><title>{data.template.name} | Email templates | Infrastructure</title></svelte:head>

<InfraEmailTemplateEditorPage template={data.template} {onsave} {ontest} {onreset} />
