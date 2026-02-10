<script>

	import Button from "$components/actions/button/Button.svelte";
	import Input from "$components/data-inputs/input/Input.svelte";
	import { Form } from "$lib/client/formstorm/form.svelte";
	import CreateSurveySchema from "./CreateSurvey.schema";    
    
    let form = new Form(CreateSurveySchema, async (data) => {
        console.log(data.name);
    });
    let err = $derived(JSON.stringify(form.errors))

</script>

<h1>Create Survey</h1>
<Input label="Survey Name" errors={form.errors['name'] || []} bind:value={form.values.name} onblur={form.validate} dirty={form.dirty} />
<Button label="Create" onclick={() => form.submit()} />