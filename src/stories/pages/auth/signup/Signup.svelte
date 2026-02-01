<script lang="ts">
	import { authClient } from "$lib/client";
	import BackupCodeStep from "./steps/BackupCodeStep.svelte";
	import FormStep from "./steps/FormStep.svelte";
	import ScanStep from "./steps/ScanStep.svelte";
	import VerifyStep from "./steps/VerifyStep.svelte";

	let step = $state(0);
	let username = $state("");
	let password = $state("");
	let totpUri: string = $state("");

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

			const { data, error } = await authClient.twoFactor.enable({
				password: "secure-password", // required
				issuer: "my-app-name",
			});

			nextStep();
		}} />	
	{/if}

	{#if step == 1}
		<ScanStep totpUri={"https://www.conecopia.com/ghjfskkgshdfs/dsfdfsd/f/dsf/df/"} onNext={() => {
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
		<BackupCodeStep codes={["sdfhjkfhwu4", "fjhaskfjfkjs", "sfhsejrfs34", "aertye4hrgs", "dsgjrsfejfu3", "fhwiuhfskelua", "gearfshehje", "hawesbfeihkfhw",]} />
	{/if}
</div>