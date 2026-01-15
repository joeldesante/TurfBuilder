<script lang="ts">
	import { goto } from "$app/navigation";
  import { authClient } from "$lib/client";

  let email = "";
  let password = "";
  let rememberMe = false;
  let loading = false;
  let error: string | null = null;

  async function signIn() {
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
</script>


<div>

  


<form on:submit|preventDefault={signIn} class="flex flex-col gap-2">
  <div class="max-w-sm space-y-3">
    <input class="py-2.5 sm:py-3 px-4 block w-full border-gray-200 rounded-lg sm:text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none" id="email" type="email" placeholder="Email" bind:value={email} required autocomplete="email" />
  </div>
  <div class="max-w-sm space-y-3">
    <input class="py-2.5 sm:py-3 px-4 block w-full border-gray-200 rounded-lg sm:text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none" id="password" type="password" placeholder="Password" bind:value={password} required autocomplete="current-password" />
  </div>
  <label>
    <input type="checkbox" bind:checked={rememberMe} />
    Remember me
  </label>

  <button type="submit" disabled={loading} class="py-3 px-4 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none">
    {loading ? "Signing in…" : "Sign In"}
  </button>

  
</form>

{#if error}
  <p>{error}</p>
{/if}

</div>