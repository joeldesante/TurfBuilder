<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { toast } from 'svelte-sonner';
	import Button from '$components/actions/button/Button.svelte';
	import Toaster from './Toaster.svelte';

	const { Story } = defineMeta({
		title: 'Components/Feedback/Toaster',
		component: Toaster,
		tags: ['autodocs'],
		argTypes: {
			position: {
				control: { type: 'select' },
				options: [
					'top-left',
					'top-center',
					'top-right',
					'bottom-left',
					'bottom-center',
					'bottom-right'
				]
			}
		}
	});
</script>

<Story name="Default" args={{ position: 'bottom-right' }}>
	{#snippet template(args)}
		<Toaster {...args} />
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" onclick={() => toast('The list was saved.')}>Message</Button>
			<Button variant="outline" onclick={() => toast.success('The PDF is ready.')}>Success</Button>
			<Button
				variant="outline"
				onclick={() => toast.error('The PDF took too long to generate. Try again shortly.')}
			>
				Error
			</Button>
			<Button
				variant="outline"
				onclick={() =>
					toast.error('Could not generate the PDF', {
						description: 'Object storage is not configured.'
					})}
			>
				Error with description
			</Button>
		</div>
	{/snippet}
</Story>
