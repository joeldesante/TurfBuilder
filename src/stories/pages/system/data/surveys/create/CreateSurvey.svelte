<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import CreateSurveySchema from './CreateSurvey.schema';

	interface Props {
		surveysHref: string;
		onCreate?: (name: string) => Promise<void>;
	}

	const { surveysHref, onCreate }: Props = $props();

	let form = new Form(CreateSurveySchema, async (data) => {
		await onCreate?.(data.name);
	});
</script>

<PageHeader
	title="Create Survey"
	breadcrumbs={[{ label: 'Surveys', href: surveysHref }, { label: 'Create' }]}
/>
<FormField label="Survey Name" class="my-4" errors={form.errors['name'] || []} dirty={form.dirty}>
	<TextInput bind:value={form.values.name} onblur={() => form.validate()} />
</FormField>
<Button onclick={() => form.submit()}>Create</Button>
