<script lang="ts">
	import type { Snippet } from 'svelte'

	interface BreadcrumbItem {
		label: string
		href?: string
	}

	interface Props {
		title: string
		subheading?: string
		breadcrumbs?: BreadcrumbItem[]
		actions?: Snippet
		class?: string
		[key: string]: unknown
	}

	let {
		title,
		subheading,
		breadcrumbs,
		actions,
		class: className = '',
		...restProps
	}: Props = $props()

	let containerClass = $derived(
		['pt-4 pb-10', className].filter(Boolean).join(' ')
	)
</script>

<div class={containerClass} {...restProps}>
	{#if breadcrumbs && breadcrumbs.length > 0}
		<nav aria-label="Breadcrumb" class="mb-6">
			<ol class="flex items-center gap-1 text-sm text-on-surface-subtle">
				{#each breadcrumbs as crumb, i}
					{#if i > 0}
						<li aria-hidden="true" class="select-none">/</li>
					{/if}
					<li>
						{#if crumb.href}
							<a href={crumb.href} class="text-on-surface-subtle hover:text-on-surface no-underline transition-colors duration-150">
								{crumb.label}
							</a>
						{:else}
							<span class="text-on-surface">{crumb.label}</span>
						{/if}
					</li>
				{/each}
			</ol>
		</nav>
	{/if}

	<div class="flex flex-col gap-6 md:flex-row md:items-center">
		<div class="space-y-2 flex-1">
			<h1 class="text-2xl text-on-surface">{title}</h1>
			{#if subheading}
				<p class="mt-1 text-sm text-on-surface-subtle">{subheading}</p>
			{/if}
		</div>
		{#if actions}
			<div class="flex gap-3 *:flex-1 md:*:flex-none md:shrink-0">
				{@render actions()}
			</div>
		{/if}
	</div>
</div>
