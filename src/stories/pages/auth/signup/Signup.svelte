<script lang="ts">
	import { authClient } from "$lib/client";
	import BackupCodeStep from "../steps/BackupCodeStep.svelte";
	import FormStep from "../steps/FormStep.svelte";
	import ScanStep from "../steps/ScanStep.svelte";
	import VerifyStep from "../steps/VerifyStep.svelte";

	let { data } = $props();

	let step: number = $state(0);
	let username: string = $state("");
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

<div>
	{#if step == 0}
		<FormStep onComplete={async (username: string, password: string) => { 
			username = username;
			password = password;

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
		}} />	
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