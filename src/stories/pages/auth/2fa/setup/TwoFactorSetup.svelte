<script lang="ts">
	import { authClient } from "$lib/client";
	import BackupCodeStep from "$pages/auth/steps/BackupCodeStep.svelte";
	import ScanStep from "$pages/auth/steps/ScanStep.svelte";
	import VerifyStep from "$pages/auth/steps/VerifyStep.svelte";
	import Input from "$components/data-inputs/input/Input.svelte";
	import Button from "$components/actions/button/Button.svelte";

	let { data } = $props();

	let step: number = $state(0);
	let password: string = $state("");
	let totpUri: string = $state("");
	let backupCodes: string[] = $state([]);
	let errorMessage = $state("");

	function nextStep() {
		step += 1;
	}

	function backStep() {
		step -= 1;
	}

</script>

<div class="p-4">
	{#if step == 0}
        <div class="p-4 flex flex-col gap-4">
            <h1 class="text-xl font-medium">You must first setup Two Factor Authentication before using { data.config.application_name }</h1>

            <div class="flex flex-col gap-2">
                <Input label="Please enter your password." bind:value={password} type="password" />
                <Button onclick={async () => {
                    const { data: tfaData, error: tfaError } = await authClient.twoFactor.enable({
                        password: password,
                        issuer: data.config.application_name,
                    });

                    if(tfaError) {
                        console.error(tfaError.message || "There was an unknown 2FA error.");
                        errorMessage = tfaError.message || "There was an unknown 2FA error.";
                        return;
                    }

                    totpUri = tfaData.totpURI;
                    backupCodes = tfaData.backupCodes;

                    nextStep();
                }}>
                    Authorize
                </Button>
            </div>
            <p>{errorMessage}</p>
        </div>
	{/if}

	{#if step == 1}
		<ScanStep totpUri={totpUri} onNext={() => {
			nextStep();
		}} />
	{/if}
    
    {#if step == 2}
		<VerifyStep 
			onVerified={() => { nextStep(); }} 
			onBack={() => { backStep(); }} 
		/>
	{/if}
    
	{#if step >= 3}
		<BackupCodeStep codes={backupCodes} />
	{/if}
</div>