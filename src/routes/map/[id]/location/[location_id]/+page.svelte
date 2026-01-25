<script lang="ts">
    const { data } = $props();
    let contactMade = $state(data.locationAttempt.contact_made)
</script>

<div>

    <section class="mb-4 p-4">
        <h1 class="text-2xl font-bold">{ data.location.loc_name }</h1>
        <div>
            <p>{ data.location.street }</p>
            <p>{ data.location.locality } { data.location.region }. { data.location.postcode }</p>
        </div>
    </section>

    <hr>

    <button class="bg-gray-500 p-2 px-4 text-white" onclick={() => { contactMade = !contactMade }}>Contact Was {#if contactMade}Not{/if} Made</button>
    
    <hr>

    {#if contactMade && data.questions.length > 0}
        <section class="p-4 flex flex-col gap-4">
            {#each data.questions as question }
                <div>
                    <h4 class="text-lg font-medium">{ question.question_text }</h4>
                    <textarea class="border-gray-400 border-1 rounded p-1" value={ data.responses.filter((response) => { return response.survey_question_id == question.id ? "" : "" })[0]?.response_value || "" }></textarea>
                </div>
            {/each}
        </section>
        <hr>
    {/if}

    <section class="p-4 flex flex-col gap-4">
        <div>
            <h4 class="text-lg font-medium">Notes:</h4>
            <textarea class="border-gray-400 border-1 rounded p-1" placeholder="Any additional notes to share?" value={ data.locationAttempt.attempt_note || "" }></textarea>
        </div>
    </section>

    <button class="bg-gray-500 p-2 px-4 text-white" type="submit">Submit Response</button>
</div>