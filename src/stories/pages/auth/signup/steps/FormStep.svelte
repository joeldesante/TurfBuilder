<script lang="ts">
	import { authClient } from "$lib/client";
	import { nanoid } from "nanoid";
	import Button from "$components/actions/button/Button.svelte";
	import Input from "$components/data-inputs/input/Input.svelte";

    interface Props {
        onComplete: (username: string, password: string) => Promise<void>
    }

    let { onComplete = async (username: string, password: string) => {} } = $props();

    let username = $state("");
    let password = $state("");
    let confirmPassword = $state("");
    let errorMessage = $state("");

    async function onSubmit() {
        try {
            if(password != confirmPassword) {
                throw new Error("Passwords do not match.")
            }

            const { error } = await authClient.signUp.email({
                email: `${nanoid()}@fake.com`,
                name: username,
                username: username,
                password: password,
            });

            if(error) {
                throw new Error(error.message)
            }

            onComplete(username, password);
        } catch(e: any) {
            errorMessage = e.message;
        }
    }

</script>
<div class="flex flex-col gap-4">
    <Input type="text" label="Username" bind:value={username} />
    <Input type="password" label="Password" bind:value={password} />
    <Input type="password" label="Confirm Password" bind:value={confirmPassword} />
    <Button label="Sign In" onclick={onSubmit} />
    <p>{errorMessage}</p>
</div>