<script lang="ts">
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

          console.log(response.data);
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

<h1>Sign In</h1>

<form
  on:submit|preventDefault={signIn}
>
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
      autocomplete="current-password"
    />
  </div>

  <div>
    <label>
      <input
        type="checkbox"
        bind:checked={rememberMe}
      />
      Remember me
    </label>
  </div>

  <button type="submit" disabled={loading}>
    {loading ? "Signing in…" : "Sign In"}
  </button>
</form>

{#if error}
  <p>{error}</p>
{/if}