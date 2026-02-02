<script lang="ts">
	import { goto } from '$app/navigation';


    interface SurveyQuestion {
        db_id: number,
        type: string,
        text: string,
        choices: string[],
        index: number,
        response: string
    }

    const { data } = $props();
    let contactMade = $state(data.locationAttempt.contact_made)
    let attemptNote = $state(data.locationAttempt.attempt_note)
    let questions: SurveyQuestion[] = $state(data.questions.map((q) => {
        return {
            db_id: parseInt(q.id),
            type: q.question_type,
            text: q.question_text,
            choices: q.question_choices,
            index: parseInt(q.order_index),
            response: data.responses.filter((response) => { 
                return response.survey_question_id == q.id ? response : "" })[0]?.response_value || ""
            }
    }))

    function updateQuestionResponse(index: number, response: string) {
        questions[index].response = response;
        questions = questions;
    }

    async function saveAttempt() {
        // Save the attempt then redirect to the map...
        const r = await fetch(`/api/surveys/${data.surveyId}/attempts/${data.locationAttempt.id}/`, {
            method: "POST",
            body: JSON.stringify({
                turf_id: parseInt(data.turfId),
                contactMade: contactMade,
                attemptNote: attemptNote,
                questions: questions
            })
        });

        if(!r.ok) {
            throw new Error("Failed to save.");
        }

        goto(`/map/${data.turfId}/`);
    }

</script>

<div>

    <a href={`/map/${data.turfId}/`}>Back to Map</a>

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
            {#each questions as question, index }
                <div class="flex flex-col gap-1">
                    <div class="flex flex-row gap-1 font-medium">
                        <p>{ index + 1 }.</p>
                        <p>{ question.text }</p>
                    </div>

                    <div class="flex flex-col gap-1">
                        {#if question.type == 'radio' }
                            {#each question.choices as choice }
                                <label>
                                    <input oninput={(e) => updateQuestionResponse(index, e.currentTarget.value)} type="radio" name={`radio_${index}`} value={choice} checked={choice == question.response}>
                                    { choice }
                                </label>
                            {/each}
                        {:else if question.type == 'check' }
                            {#each question.choices as choice }
                                <label>
                                    <input type="checkbox" name={`check_${index}`} value={choice} checked={ question.response.split(',').find((c) => c == choice) != undefined }>
                                    { choice }
                                </label>
                            {/each}
                        {:else}
                            <textarea oninput={(e) => updateQuestionResponse(index, e.currentTarget.value)} class="bg-gray-200 p-2" value={question.response}></textarea>
                        {/if}
                    </div>
                </div>
            {/each}
        </section>
        <hr>
    {/if}

    <section class="p-4 flex flex-col gap-4">
        <div>
            <h4 class="text-lg font-medium">Notes:</h4>
            <textarea class="border-gray-400 border rounded p-1" placeholder="Any additional notes to share?" bind:value={ attemptNote }></textarea>
        </div>
    </section>

    <button class="bg-gray-500 p-2 px-4 text-white" type="submit" onclick={saveAttempt}>Submit Response</button>
</div>