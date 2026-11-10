<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { HeartIcon } from 'phosphor-svelte';
	import CollapsibleCard from './CollapsibleCard.svelte';

	const { Story } = defineMeta({
		title: 'Components/Layout/Collapsible Card',
		component: CollapsibleCard,
		tags: ['autodocs'],
		args: { title: 'Our Values' }
	});
</script>

<Story name="Open">
	{#snippet template(args)}
		<CollapsibleCard title={args.title} open={args.open}>
			<p>We are a mission-driven organization.</p>
			<p>Every organizer we serve shares a commitment to building change, one door at a time.</p>
		</CollapsibleCard>
	{/snippet}
</Story>

<Story name="Closed" args={{ open: false }}>
	{#snippet template(args)}
		<CollapsibleCard title={args.title} open={args.open}>
			<p>This text is hidden until the heading is clicked.</p>
		</CollapsibleCard>
	{/snippet}
</Story>

<Story name="With icon">
	{#snippet template(args)}
		<CollapsibleCard title={args.title} open={args.open}>
			{#snippet icon()}<HeartIcon />{/snippet}
			<p>The icon sits before the title.</p>
		</CollapsibleCard>
	{/snippet}
</Story>
