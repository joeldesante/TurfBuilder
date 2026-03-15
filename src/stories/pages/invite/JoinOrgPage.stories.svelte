<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import JoinOrgPage from './JoinOrgPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Invite/JoinOrgPage',
		component: JoinOrgPage,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle: 'Public page shown when a user follows an org invite link.'
			}
		}
	});
</script>

<Story
	name="Join Prompt"
	args={{ orgName: 'North West Philly Alliance', orgSlug: 'north-west-philly-alliance', alreadyMember: false }}
/>

<Story
	name="Already a Member"
	args={{ orgName: 'North West Philly Alliance', orgSlug: 'north-west-philly-alliance', alreadyMember: true }}
/>
