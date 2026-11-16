<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SchemaFieldPicker from './SchemaFieldPicker.svelte';
	import type { FilterSource } from '$lib/client/filter-source';

	const church = {
		id: 's1',
		org_id: 'o',
		schema_name: 'Church',
		fields: [
			{ id: 'f1', name: 'Denomination', type: 'text' as const, required: true },
			{ id: 'f2', name: 'Members', type: 'number' as const, required: false },
			{ id: 'f3', name: 'Open', type: 'boolean' as const, required: false }
		],
		identifier_field_id: 'f1',
		contact_count: 0,
		created_at: '',
		updated_at: ''
	};

	const source: FilterSource = {
		listBuckets: async () => [],
		listLists: async () => [],
		listSurveys: async () => [],
		listQuestions: async () => [],
		listSchemas: async () => [church]
	};

	const { Story } = defineMeta({
		title: 'Components/Universe/SchemaFieldPicker',
		component: SchemaFieldPicker,
		args: { source, value: null, onchange: () => {} }
	});
</script>

<Story name="Empty" />
<Story name="Text Field" args={{ value: { schemaId: 's1', fieldId: 'f1', value: 'Baptist' } }} />
<Story name="Number Field" args={{ value: { schemaId: 's1', fieldId: 'f2', value: 120 } }} />
<Story name="True False Field" args={{ value: { schemaId: 's1', fieldId: 'f3', value: true } }} />
<Story name="Field Removed" args={{ value: { schemaId: 's1', fieldId: 'gone', value: 'x' } }} />
