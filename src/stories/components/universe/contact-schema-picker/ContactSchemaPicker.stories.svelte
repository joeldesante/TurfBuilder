<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ContactSchemaPicker from './ContactSchemaPicker.svelte';
	import type { FilterSource } from '$lib/client/filter-source';

	const schema = (id: string, name: string) => ({
		id,
		org_id: 'o',
		schema_name: name,
		fields: [],
		identifier_field_id: null,
		contact_count: 0,
		created_at: '',
		updated_at: ''
	});

	const source: FilterSource = {
		listBuckets: async () => [],
		listLists: async () => [],
		listSurveys: async () => [],
		listQuestions: async () => [],
		listSchemas: async () => [schema('s1', 'Church'), schema('s2', 'Shop')]
	};

	const { Story } = defineMeta({
		title: 'Components/Universe/ContactSchemaPicker',
		component: ContactSchemaPicker,
		args: { source, value: null, onchange: () => {} }
	});
</script>

<Story name="Empty" />
<Story name="Chosen" args={{ value: { schemaId: 's1' } }} />
<Story name="Schema No Longer Exists" args={{ value: { schemaId: 'gone' } }} />
