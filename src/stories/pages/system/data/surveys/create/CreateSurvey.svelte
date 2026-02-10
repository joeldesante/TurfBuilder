<script>
	import Button from "$components/actions/button/Button.svelte";
	import Input from "$components/data-inputs/input/Input.svelte";

    let name = $state("");

    async function createSurvey() {
        return null;
    }

</script>
<h1>Create Survey</h1>
<p>Create a new survey</p>

<Input label="Survey Name" bind:value={name} />
<Button label="Create" onclick={createSurvey} />