<script lang="ts">
	import FormStep from "../steps/FormStep.svelte";
	import { goto } from "$app/navigation";

	let { data } = $props();
	let errorMessage = $state("");

</script>

<div>
	<FormStep onComplete={async (username: string, password: string) => { 
		username = username;
		password = password;
		goto("/");
	}} />
</div>