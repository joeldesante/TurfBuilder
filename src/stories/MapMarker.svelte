<script lang="ts">
  let { state } = $props<{ state: { isSelected: boolean } }>();
</script>

<div class="marker" class:selected={state.isSelected}>
  <!-- Your marker SVG or content -->
</div>

<style>
  .marker {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: #3b82f6;
    border: 2px solid white;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .marker.selected {
    background-color: #ef4444;
    transform: scale(1.2);
  }
</style>