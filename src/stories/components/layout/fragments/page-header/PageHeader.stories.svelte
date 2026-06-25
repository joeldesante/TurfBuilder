<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PageHeader from './PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';

	const { Story } = defineMeta({
		title: 'Components/Layout/Page Header',
		component: PageHeader,
		tags: ['autodocs'],
		argTypes: {
			title: {
				control: 'text',
				description: 'The main heading rendered as an <code>&lt;h1&gt;</code>. Required.'
			},
			subheading: {
				control: 'text',
				description: 'Optional secondary line rendered beneath the title in a muted style.'
			},
			breadcrumbs: {
				control: false,
				description:
					'Ordered list of ancestor pages shown above the title. Each item takes a <code>label</code> and an optional <code>href</code> — omit <code>href</code> on the current (last) item to render it as plain text.'
			},
			actions: {
				control: false,
				description:
					'Snippet rendered to the right of the title on desktop, or stacked below it on mobile. Typically one or two <code>Button</code> elements. Each button stretches to full width on mobile.'
			},
			class: {
				control: false,
				description: 'Additional CSS classes forwarded to the root <code>&lt;div&gt;</code>.',
				table: { category: 'Styling' }
			}
		},
		parameters: {
			docs: {
				subtitle:
					'Page-level header for the admin dashboard with optional breadcrumbs, subheading, and right-aligned action buttons. Renders with its own vertical padding so the layout content div needs no extra top padding.'
			},
			layout: 'padded'
		}
	});

	const surveyCrumbs = [
		{ label: 'Surveys', href: '/o/demo-org/s/data/surveys' },
		{ label: 'Neighborhood Survey' }
	];
</script>

<Story name="Title Only" args={{ title: 'Dashboard' }} />

<Story name="With Primary Action" asChild>
	<PageHeader title="Turfs">
		{#snippet actions()}
			<Button variant="primary">Cut Turfs</Button>
		{/snippet}
	</PageHeader>
</Story>

<Story name="Full" asChild>
	<PageHeader
		title="Neighborhood Survey"
		subheading="Responses collected door-to-door in Precinct 4 during the spring canvassing drive."
		breadcrumbs={surveyCrumbs}
	>
		{#snippet actions()}
			<Button variant="outline">Edit</Button>
			<Button variant="primary">Export Results</Button>
		{/snippet}
	</PageHeader>
</Story>
