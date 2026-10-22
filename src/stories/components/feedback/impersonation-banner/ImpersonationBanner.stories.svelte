<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ImpersonationBanner from './ImpersonationBanner.svelte';

	const { Story } = defineMeta({
		title: 'Components/Feedback/ImpersonationBanner',
		component: ImpersonationBanner,
		tags: ['autodocs'],
		args: { onstop: async () => {} },
		parameters: {
			docs: {
				subtitle:
					'Stays at the top of every page while an infrastructure admin is signed in as someone else, with a way back.'
			}
		}
	});
</script>

<Story name="Impersonating" args={{ userName: 'Alan Turing' }} />

<Story
	name="Stop fails"
	args={{
		userName: 'Alan Turing',
		onstop: async () => {
			throw new Error('The impersonation could not be ended. Sign out and sign in again.');
		}
	}}
/>
