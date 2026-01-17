<script lang="ts">
	import { goto } from "$app/navigation";
  import { authClient } from "$lib/client";

  const { data } = $props();

  let email = $state("");
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
          let response = await authClient.signIn.email({
              email,
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

  async function signInAnon() {
    anonLoading = true
    error = null;

    try {
        let response = await authClient.signIn.anonymous();

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
        anonLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Sign In | { data.config.application_name }</title>
</svelte:head>

<div class="flex w-screen h-screen justify-center items-center flex-col gap-4">
  <form onsubmit={signIn} class="flex flex-col gap-2 p-4 w-64 md:w-128">
    
    <h1 class="text-2xl font-medium mb-4">Sign In</h1>

    <input class="py-2.5 sm:py-3 px-4 block w-full border-1 border-gray-200 rounded sm:text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none" id="email" type="email" placeholder="Email" bind:value={email} required autocomplete="email" />
    <input class="py-2.5 sm:py-3 px-4 block w-full border-1 border-gray-200 rounded sm:text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none" id="password" type="password" placeholder="Password" bind:value={password} required autocomplete="current-password" />
    
    <div class="flex">
      <input type="checkbox" bind:checked={rememberMe} class="shrink-0 mt-0.5 border-gray-200 rounded-sm text-blue-600 focus:ring-blue-500 checked:border-blue-500 disabled:opacity-50 disabled:pointer-events-none" id="rememberMe">
      <label for="rememberMe" class="text-sm text-gray-500 ms-3">Remember me</label>
    </div>

    <div class="mt-4">
      <button type="submit" disabled={loading} class="cursor-pointer py-3 px-4 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none">
        {loading ? "Signing in…" : "Sign In"}
      </button>
    </div>

    {#if error}
      <p>{error}</p>
    {/if}
  </form>

  <div class="font-bold">
    OR
  </div>

  <div class="flex gap-2 items-center justify-center w-64 md:w-128 p-4 border-1 border-gray-200 rounded shadow-lg">
    <span class="font-medium">You may also,</span>
    <button type="button" disabled={anonLoading} onclick={signInAnon} class="cursor-pointer py-3 px-4 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-500 hover:border-blue-600 hover:text-blue-600 focus:outline-hidden focus:border-blue-600 focus:text-blue-600 disabled:opacity-50 disabled:pointer-events-none">
      {anonLoading ? "Signing in…" : "Sign In Anonymously"}
    </button>
  </div>

</div>