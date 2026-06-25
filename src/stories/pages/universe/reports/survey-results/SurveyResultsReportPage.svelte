<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';

	interface AnswerBreakdown {
		option: string;
		count: number;
	}

	interface QuestionResult {
		question_text: string;
		answers: AnswerBreakdown[];
	}

	interface Props {
		orgSlug: string;
		questions?: QuestionResult[];
	}

	const { orgSlug, questions = [] }: Props = $props();

	function total(answers: AnswerBreakdown[]): number {
		return answers.reduce((sum, a) => sum + a.count, 0);
	}
</script>

<div>
	<PageHeader
		title="Survey Results"
		breadcrumbs={[
			{ label: 'Reports', href: `/o/${orgSlug}/s/universe/reports` },
			{ label: 'Survey Results' }
		]}
		subheading="Answer breakdowns for each survey question across all submissions."
	/>

	{#if questions.length === 0}
		<div class="rounded-xl border border-outline bg-surface-container p-6">
			<p class="text-sm text-on-surface-subtle">No survey results recorded yet.</p>
		</div>
	{:else}
		<div class="space-y-6">
			{#each questions as q}
				{@const questionTotal = total(q.answers)}
				<div class="rounded-xl border border-outline bg-surface-container p-6">
					<h2 class="text-base font-medium text-on-surface">{q.question_text}</h2>
					<p class="mt-1 text-xs text-on-surface-subtle">{questionTotal.toLocaleString()} total responses</p>
					<div class="mt-4 space-y-3">
						{#each q.answers as answer}
							{@const pct = questionTotal > 0 ? Math.round((answer.count / questionTotal) * 100) : 0}
							<div>
								<div class="flex items-center justify-between text-sm mb-1">
									<span class="text-on-surface">{answer.option}</span>
									<span class="text-on-surface-subtle">{answer.count.toLocaleString()} ({pct}%)</span>
								</div>
								<div class="h-2 rounded-full bg-surface-container-high overflow-hidden">
									<div
										class="h-full rounded-full bg-primary"
										style="width: {pct}%"
										role="progressbar"
										aria-valuenow={pct}
										aria-valuemin={0}
										aria-valuemax={100}
										aria-label="{answer.option}: {pct}%"
									></div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
