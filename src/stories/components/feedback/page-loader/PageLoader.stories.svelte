<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PageLoader from './PageLoader.svelte';

	const { Story } = defineMeta({
		title: 'Components/Feedback/PageLoader',
		component: PageLoader,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle:
					'A full-screen cover with the wave Loading logo. It fades in when shown and out when hidden, so the page behind it is revealed gently.'
			}
		}
	});
</script>

<Story name="Visible" args={{ visible: true }} />

<Story name="Cut In" args={{ visible: true, cutIn: true }} />

<Story name="Hidden" args={{ visible: false }} />

<Story name="Logo After A Delay" args={{ visible: true, logoDelayMs: 1000 }} />

<Story
	name="Logo After A Delay, Held For A Second"
	args={{ visible: true, logoDelayMs: 1000, logoMinMs: 1000 }}
/>

<Story
	name="Slow Load Message"
	args={{ visible: true, logoDelayMs: 0, slowMessageDelayMs: 2000 }}
/>
