<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import MapPopup from './MapPopup.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Display/Map Popup',
		component: MapPopup,
		tags: ['autodocs'],
		argTypes: {
			locationName: {
				control: 'text',
				description: 'The display name of the location.'
			},
			street: {
				control: 'text',
				description: 'Street address line.'
			},
			locality: {
				control: 'text',
				description: 'City or locality.'
			}
		},
		parameters: {
			docs: {
				subtitle:
					'Popup content for a map marker. Designed for use with MapLibre GL via Popup.setDOMContent().'
			}
		}
	});
</script>

<Story name="Name Only" args={{ locationName: 'Volo Coffeehouse' }} />

<Story name="With Street" args={{ locationName: 'Volo Coffeehouse', street: '112 S Wayne Ave' }} />

<Story
	name="With Full Address"
	args={{ locationName: 'Volo Coffeehouse', street: '112 S Wayne Ave', locality: 'Wayne, PA' }}
/>

<Story name="Gallery" asChild>
	<div class="flex flex-col gap-6 p-8">
		<div class="inline-flex rounded-xl border border-outline-subtle bg-surface px-4 py-3 shadow-lg">
			<MapPopup locationName="Volo Coffeehouse" />
		</div>
		<div class="inline-flex rounded-xl border border-outline-subtle bg-surface px-4 py-3 shadow-lg">
			<MapPopup locationName="Volo Coffeehouse" street="112 S Wayne Ave" />
		</div>
		<div class="inline-flex rounded-xl border border-outline-subtle bg-surface px-4 py-3 shadow-lg">
			<MapPopup locationName="Volo Coffeehouse" street="112 S Wayne Ave" locality="Wayne, PA" />
		</div>
	</div>
</Story>
