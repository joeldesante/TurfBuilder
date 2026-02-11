<script lang="ts">
	import { goto } from "$app/navigation";
	import Button from "$components/actions/button/Button.svelte";
  import { authClient } from "$lib/client";

  const { data } = $props();

  let username = $state("");
  let password = $state("")
  let rememberMe = $state(false);
  let loading = $state(false);
  let anonLoading = $state(false);
  let error: string | null = $state("");

  async function signIn(event: Event) {
      event.preventDefault();

      loading = true;
      error = null;

      try {
          let response = await authClient.signIn.username({
              username,
              password,
              rememberMe,
          });

          if(response.error) {
              throw new Error(response.error.message);
          }

          goto("/");
      } catch(e) {
          if(e instanceof Error) {
              error = e.message;
          } else {
              error = "Unkknown error."
          }
          console.warn(e);
      } finally {
          loading = false;
      }
  }
</script>

<svelte:head>
  <title>Sign In | { data.config.application_name }</title>
</svelte:head>

<div class="flex w-screen h-screen justify-center items-center flex-col gap-4">
  <form onsubmit={signIn} class="flex flex-col gap-2 p-4 w-64 md:w-lg">
    
    <h1 class="text-2xl font-medium mb-4">Sign In</h1>

    <input class="py-2.5 sm:py-3 px-4 block w-full border border-outline rounded sm:text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none" id="email" type="text" placeholder="Username" bind:value={username} required autocomplete="username" />
    <input class="py-2.5 sm:py-3 px-4 block w-full border border-outline rounded sm:text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none" id="password" type="password" placeholder="Password" bind:value={password} required autocomplete="current-password" />
    
    <div class="flex">
      <input type="checkbox" bind:checked={rememberMe} class="shrink-0 mt-0.5 border-outline rounded-sm text-blue-600 focus:ring-blue-500 checked:border-blue-500 disabled:opacity-50 disabled:pointer-events-none" id="rememberMe">
      <label for="rememberMe" class="text-sm text-on-surface-subtle ms-3">Remember me</label>
    </div>

    <div class="mt-4">
      <Button type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign In"}
      </Button>
    </div>

    {#if error}
      <p>{error}</p>
    {/if}
  </form>

  <div class="flex flex-col items-center gap-4">
    <p class="font-bold">OR</p>
    <a class="underline text-primary" href="/auth/signup">Sign Up for an Account</a>
  </div>

</div>