<script lang="ts">
	import { goto } from "$app/navigation";
  import { authClient } from "$lib/client";

  const { data } = $props();

  let username = "";
  let email = "";
  let password = "";
  let loading = false;
  let error: string | null = null;

  async function signUp() {
      loading = true;
      error = null;

      try {
          let response = await authClient.signUp.email({
            name: username,
            email: email,
            password: password
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
  <title>Sign Up | { data.config.application_name }</title>
</svelte:head>

<h1>Sign Up</h1>

<form
  on:submit|preventDefault={signUp}
>
  <div>
    <label for="name">Username</label><br />
    <input
      id="name"
      type="text"
      bind:value={username}
      required
    />
  </div>

  <div>
    <label for="email">Email</label><br />
    <input
      id="email"
      type="email"
      bind:value={email}
      required
      autocomplete="email"
    />
  </div>

  <div>
    <label for="password">Password</label><br />
    <input
      id="password"
      type="password"
      bind:value={password}
      required
    />
  </div>

  <button type="submit" disabled={loading}>
    {loading ? "Signing up…" : "Sign Up"}
  </button>
</form>

{#if error}
  <p>{error}</p>
{/if}