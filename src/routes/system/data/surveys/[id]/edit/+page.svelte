<script lang="ts">
    const { data } = $props();
    console.log(data)

    interface Survey {
        name: string,
        description: string,
        questions: SurveyQuestion[]
    }

    interface SurveyQuestion {
        db_id?: number,
        type: string,
        text: string,
        choices: string[],
        index: number
    }

    let survey: Survey = $state({
        name: data.survey.name,
        description: data.survey.description,
        questions: data.questions.map((question: any, index: number): SurveyQuestion => {
            return {
                db_id: parseInt(question.id),
                type: question.question_type as string,
                text: question.question_text as string,
                choices: question.question_choices || [],
                index: index
            }
        })
    })
    let unsavedChanges: boolean = $state(false);

    function updateSurveyName(name: string) {
        survey = {
            ...survey,
            name: name
        }
        unsavedChanges = true;
    }

    function updateSurveyDescription(description: string) {
        survey = {
            ...survey,
            description: description
        }
        unsavedChanges = true;
    }

    function addQuestion() {
        survey = {
            ...survey,
            questions: [ ...survey.questions, {
                type: "text",
                text: "New question",
                choices: [],
                index: survey.questions.length
            } ]
        }
        unsavedChanges = true;
    }

    function deleteQuestion(index: number) {
        survey.questions.splice(index, 1);
        survey = {
            ...survey,
            questions: survey.questions
        }
        unsavedChanges = true;
    }

    function updateQuestionText(index: number, value: string) {
        survey.questions[index].text = value;
        survey = {
            ...survey,
            questions: survey.questions
        }
        unsavedChanges = true;
    }

    function updateQuestionType(index: number, value: string) {
        survey.questions[index].type = value;
        survey = {
            ...survey,
            questions: survey.questions
        }
        unsavedChanges = true;
    }

    function addQuestionChoice(index: number, value: string) {
        survey.questions[index].choices.push(value);
        survey = {
            ...survey,
            questions: survey.questions
        }
        unsavedChanges = true;
    }

    function deleteQuestionChoice(questionIndex: number, choiceIndex: number) {
        survey.questions[questionIndex].choices.splice(choiceIndex, 1);
        survey = {
            ...survey,
            questions: survey.questions
        }
        unsavedChanges = true;
    }

    function updateQuestionChoice(questionIndex: number, choiceIndex: number, value: string) {
        survey.questions[questionIndex].choices[choiceIndex] = value;
        survey = {
            ...survey,
            questions: survey.questions
        }
        unsavedChanges = true;
    }

    async function saveChanges() {
        // Verify everything is valid...
        const survey_meta = {
            name: survey.name,
            description: survey.description
        }

        const questions = survey.questions;
        const db_question_ids = questions.filter(v => v.db_id !== undefined).map(q => q.db_id);

        //1. Update name and description
        const s1 = await fetch(`/api/surveys/${data.survey.id}`, {
            method: "PUT",
            body: JSON.stringify({
                name: survey.name,
                description: survey.description
            })
        });

        //2. Delete any question which id no longer exists in the question set
        const s2 = await fetch(`/api/surveys/${data.survey.id}/questions/purge`, {
            method: "POST",
            body: JSON.stringify({
                exclude: db_question_ids
            })
        });

        //3. Update and add any question.. also update the order index..
        const s3 = await fetch(`/api/surveys/${data.survey.id}/questions`, {
            method: "POST",
            body: JSON.stringify({
                questions: survey.questions
            })
        });

        if(s1.ok && s2.ok && s3.ok) {
            unsavedChanges = false;
        }
    }

</script>

{#if unsavedChanges == true }
    <div class="flex justify-between p-4 bg-gray-100 border fadeInAndUp rounded absolute bottom-0 left-0 right-0 m-4 shadow-lg">
        <p class="font-medium">You have unsaved changes</p>
        <button onclick={saveChanges}>Save Changes</button>
    </div>
{/if}

<div>
    <button>Preview</button>
    <button onclick={saveChanges}>Save</button>
    <button>Publish</button>
</div>

<div class="flex flex-col gap-4">

    <div class="flex flex-col">
        <label for="name" class="font-medium">Name</label>
        <input id="name" type="text" value={ survey.name } oninput={ (e) => updateSurveyName(e.currentTarget.value) } placeholder="Survey name..." />
    </div>

    <div class="flex flex-col">
        <label for="description" class="font-medium">Description</label>
        <textarea id="description" value={ survey.description } oninput={ (e) => updateSurveyDescription(e.currentTarget.value) } placeholder="Survey description..."></textarea>
    </div>
    
</div>

<hr>

<h2 class="text-lg font-medium mb-2">Questions</h2>
<button onclick={addQuestion}>Add Question</button>
<div class="space-y-4">
    {#each survey.questions as question, index }
        <div class="p-4 rounded shadow">
            <div class="flex flex-row font-medium justify-between items-center">
                <div class="flex flex-row gap-1">
                    <p>{ index + 1 }.</p>
                    <input class="block w-full" type="text" value={question.text} oninput={(e) => updateQuestionText(index, e.currentTarget.value)} />
                </div>
                <button class="cursor-pointer" onclick={() => deleteQuestion(index)}>Delete</button>
            </div>

            <select value={question.type} oninput={(e) => { updateQuestionType(index, e.currentTarget.value) }}>
                <option value="text">Text Response</option>
                <option value="radio">Choose One Response</option>
                <option value="check">Choose Many Response</option>
            </select>

            <div>
                {#if question.type == 'text' }
                    <p class="p-2 bg-gray-200 rounded mt-2">Users will submit a text response...</p>
                {:else if question.type == 'radio' || question.type == 'check' }
                    <button onclick={() => addQuestionChoice(index, "New Choice")}>Add Choice</button>
                    <ul>
                        {#each question.choices as choice, choiceIndex }
                            <li>
                                <input type="text" value={ choice } oninput={(e) => updateQuestionChoice(index, choiceIndex, e.currentTarget.value)}> 
                                <button onclick={() => deleteQuestionChoice(index, choiceIndex)}>Delete</button>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <p>Please select a valid question type...</p>
                {/if}
            </div>
            <!-- Here based on the type we will render the correct input. Type is selected when adding question. It can not be changed later. -->
        </div>
    {/each}
</div>

<style>
    @keyframes fadeInUp {
        0% {
            opacity: 0;
            transform: translateY(20px); /* Starts 20px below its final position */
        }
        100% {
            opacity: 1;
            transform: translateY(0); /* Ends at its original vertical position */
        }
    }

    .fadeInAndUp {
        animation-name: fadeInUp;
        animation-duration: 0.2s; /* Adjust duration as needed */
        animation-timing-function: ease-out; /* Optional: adds a natural feel */
        animation-fill-mode: backwards; /* Ensures the element is hidden before animation starts */
    }
</style>