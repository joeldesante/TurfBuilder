<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraSettingsPage from './InfraSettingsPage.svelte';
	import { credentials, settings } from './fixtures';

	const { Story } = defineMeta({
		title: 'Pages/Infra/Settings',
		component: InfraSettingsPage,
		tags: ['autodocs'],
		args: {
			settings,
			credentials,
			tab: 'general',
			onsave: async () => ({ ok: true as const, restartRequired: false }),
			ontestmail: async () => 'Sent a test email to you@example.com.',
			onteststorage: async () => 'The bucket accepted a test file.'
		},
		parameters: {
			layout: 'fullscreen',
			docs: { subtitle: 'Site-wide settings in tabs. Every field comes from the settings registry, so a new setting appears here by being registered.' }
		}
	});
</script>

<Story name="General" />

<Story name="Organizations" args={{ tab: 'organizations' }} />

<Story name="Appearance" args={{ tab: 'appearance' }} />

<Story name="Email" args={{ tab: 'email' }} />

<Story name="Storage" args={{ tab: 'storage' }} />

<Story name="Activity" args={{ tab: 'activity' }} />

<Story name="Analytics" args={{ tab: 'analytics' }} />

<Story name="Telemetry" args={{ tab: 'telemetry' }} />

<Story name="External tools" args={{ tab: 'links' }} />
