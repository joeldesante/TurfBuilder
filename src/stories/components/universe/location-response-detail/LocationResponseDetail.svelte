<script lang="ts" module>
	export interface MetricsQuestionResponse {
		value: string;
		respondedAt: string;
		respondedBy: string | null;
	}

	export interface MetricsQuestion {
		id: string;
		text: string;
		type: string;
		choices: string[];
		responses: MetricsQuestionResponse[];
	}

	export interface MetricsLocationResult {
		id: string;
		name: string | null;
		address_line_1: string | null;
		city: string | null;
		latitude: number;
		longitude: number;
		questions: MetricsQuestion[];
	}
</script>

<script lang="ts">
	import XIcon from 'phosphor-svelte/lib/X';

	interface Props {
		location: Pick<MetricsLocationResult, 'name' | 'address_line_1' | 'city' | 'questions'>;
		onClose: () => void;
	}

	const { location, onClose }: Props = $props();

	function formatRespondedAt(value: string): string {
		return new Date(value).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<aside class="w-80 shrink-0 border-l border-outline-subtle p-4 space-y-4 overflow-y-auto">
	<div class="flex items-start justify-between gap-2">
		<div>
			<h3 class="text-sm font-semibold text-on-surface">{location.name ?? 'Unnamed location'}</h3>
			{#if location.address_line_1 || location.city}
				<p class="text-xs text-on-surface-subtle">
					{[location.address_line_1, location.city].filter(Boolean).join(', ')}
				</p>
			{/if}
		</div>
		<button
			class="text-on-surface-subtle flex items-center justify-center w-7 h-7 rounded-md shrink-0 cursor-pointer hover:bg-surface-container hover:text-on-surface focus:outline-none"
			onclick={onClose}
			aria-label="Close location details"
		>
			<XIcon size={16} />
		</button>
	</div>

	{#if location.questions.length === 0}
		<p class="text-sm text-on-surface-subtle">No responses recorded for this location.</p>
	{:else}
		<div class="space-y-4">
			{#each location.questions as question (question.id)}
				<div class="space-y-1.5">
					<p class="text-sm font-medium text-on-surface">{question.text}</p>
					{#if question.responses.length === 0}
						<p class="text-xs text-on-surface-subtle italic">No responses yet.</p>
					{:else}
						<ul class="space-y-1.5">
							{#each question.responses as response, i (i)}
								<li class="bg-surface-container rounded-md px-2.5 py-2">
									<p class="text-sm text-on-surface">{response.value}</p>
									<p class="text-xs text-on-surface-subtle">
										{response.respondedBy ?? 'Unknown user'} &middot; {formatRespondedAt(
											response.respondedAt
										)}
									</p>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</aside>
