<script module lang="ts">
	export const meta = {
		title: 'Pages/Infra/Email'
	};
</script>

<script lang="ts">
	import { Story } from '@storybook/addon-svelte-csf';
	import InfraEmailPage from './InfraEmailPage.svelte';

	const defaultSettings = [
		{ key: 'mail.transport', value: 'direct', description: 'The mail transport used to send outgoing emails.' },
		{ key: 'mail.domain', value: '', description: 'The domain from which outgoing emails are sent.' }
	];

	async function onSave(key: string, value: string) {
		await new Promise((r) => setTimeout(r, 600));
		console.log('saved', key, value);
	}
</script>

<Story name="Default">
	<InfraEmailPage settings={defaultSettings} {onSave} />
</Story>

<Story name="SES Configured">
	<InfraEmailPage
		settings={[
			{ key: 'mail.transport', value: 'ses', description: 'The mail transport used to send outgoing emails.' },
			{ key: 'mail.domain', value: 'mail.example.com', description: 'The domain from which outgoing emails are sent.' }
		]}
		{onSave}
	/>
</Story>
