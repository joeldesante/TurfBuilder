<script lang="ts">
	import { untrack } from 'svelte';
	import FilterGroup from '$components/universe/filter-group/FilterGroup.svelte';
	import type { FilterGroup as FilterGroupValue } from '$lib/shared/types/filters';
	import { provideSurveyFilterSource } from '$components/universe/filter-group/filter-source.svelte';
	import { createSurveyFilterSource } from '$lib/client/survey-filter-source';
	import type { SurveyFilterSource } from '$lib/client/survey-filter-source';
	import type { FilterRegistryEntry } from '$lib/shared/types/filter-registry';

	interface Props {
		/**
		 * The whole query. It is always a group: the root group is the foundation
		 * of the query and cannot be removed. Bindable so parents can read it on submit.
		 */
		group?: FilterGroupValue;
		/** Filters offered in the catalog. Defaults to the full shared registry. */
		catalog?: FilterRegistryEntry[];
		/** The organization whose buckets and surveys the survey response filter offers. Without it (or `surveySource`) that filter cannot load its choices. */
		orgId?: string;
		/** Overrides where survey choices come from; defaults to the API for `orgId`. */
		surveySource?: SurveyFilterSource;
	}

	let { group = $bindable({ operator: 'AND', filters: [] }), catalog, orgId, surveySource }: Props = $props();

	// Context is fixed when the component is created, so these are read once.
	const source = untrack(() => surveySource ?? (orgId ? createSurveyFilterSource(orgId) : undefined));
	if (source) provideSurveyFilterSource(source);
</script>

<FilterGroup {group} {catalog} onchange={(next) => (group = next)} />
