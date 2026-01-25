<script lang="ts">
    const { data } = $props();
    console.log(data)
</script>

<div class="flex flex-col gap-4">

    <div class="flex flex-col">
        <label for="name" class="font-medium">Name</label>
        <input id="name" type="text" value={ data.survey.name } placeholder="Survey name..." />
    </div>

    <div class="flex flex-col">
        <label for="description" class="font-medium">Description</label>
        <textarea id="description" value={ data.survey.descripton } placeholder="Survey description..."></textarea>
    </div>
    
</div>

<hr>

<h2 class="text-lg font-medium mb-2">Questions</h2>
<div class="space-y-4">
    {#each data.questions as question }
        <div class="p-4 rounded shadow">
            <p>{ question.question_text }</p>
            <!-- Here based on the type we will render the correct input. Type is selected when adding question. It can not be changed later. -->
        </div>
    {/each}
</div>