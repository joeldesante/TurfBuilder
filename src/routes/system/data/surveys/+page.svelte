<script>
    let { data } = $props();
    console.log(data.surveys)
</script>

<h1>Surveys</h1>

{#each data.surveys as survey }
    <a href="/system/data/surveys/{survey.id}">{ survey.name }</a>
{/each}