<script lang="ts">
	import Time from 'svelte-time/Time.svelte';

  let { data } = $props();
  
  // Now you can access data.turfs
  //@ts-ignore
  const turfs = data.turfs;
</script>

<div>
    <div class="grid grid-cols-3 gap-2 border-b">
      <p>Code</p>
      <p>Created</p>
      <p>Expires</p>
    </div>
  {#each turfs as turf}
    <div class="grid grid-cols-4 gap-2 border-b">
      <p>{turf.code}</p>
      <p>{turf.username}</p>
      <p><Time timestamp={turf.created_at} format="MMM DD, YYYY" /></p>
      <p><Time timestamp={turf.expires_at} format="MMM DD, YYYY" /></p>
    </div>
  {/each}
</div>