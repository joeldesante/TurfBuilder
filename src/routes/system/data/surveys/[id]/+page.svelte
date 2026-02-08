<script lang="ts">
    const { data } = $props();
    console.log(data)
</script>

<p>
    This survey has no responses yet. Once this survey recieves its first response you will not be able to modify it.
</p>

<h1>{ data.survey.name }</h1>
<p>{ data.survey.descripton }</p>
<a href="/system/data/surveys/{ data.survey.id.toString() }/edit">Edit</a>

<hr>

<h2 class="text-lg font-medium mb-2">Questions</h2>
<div class="space-y-4 overflow-y-scroll">
    {#each data.questions as question }
        <div class="p-4 rounded shadow">
            <p>{ question.question_text }</p>
            <!-- Here based on the type we will render the correct input. Type is selected when adding question. It can not be changed later. -->
        </div>
    {/each}
</div>