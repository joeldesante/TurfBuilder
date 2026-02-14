<script lang="ts">
	import Signup from "../../../stories/pages/auth/signup/Signup.svelte";

  let { data } = $props();

</script>

<svelte:head>
  <title>Sign Up | { data.config.application_name }</title>
</svelte:head>

<Signup data={data} />