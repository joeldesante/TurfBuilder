<script lang="ts">
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
    <div class="grid grid-cols-3 gap-2 border-b">
      <p>{turf.code}</p>
      <p>{turf.created_at}</p>
      <p>{turf.expires_at}</p>
    </div>
  {/each}
</div>