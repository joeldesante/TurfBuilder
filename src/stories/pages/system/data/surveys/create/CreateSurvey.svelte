<script>
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import CreateSurveySchema from './CreateSurvey.schema';

	let form = new Form(CreateSurveySchema, async (data) => {
		console.log(data.name);
	});
	let err = $derived(JSON.stringify(form.errors));
</script>

<h1>Create Survey</h1>
<FormField label="Survey Name" class="my-4" errors={form.errors['name'] || []} dirty={form.dirty}>
	<TextInput bind:value={form.values.name} onblur={form.validate} />
</FormField>
<Button onclick={() => form.submit()}>Create</Button>
