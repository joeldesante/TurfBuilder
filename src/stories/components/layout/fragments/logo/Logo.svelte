<script lang="ts">
  import LogoPaths from './LogoPaths.svelte';

  interface Props {
    width?: number | string;
    height?: number | string;
    color?: string;
  }

  const { width, height, color = 'var(--primary)' }: Props = $props();

  const svgWidth = $derived(
    width != null
      ? (typeof width === 'number' ? `${width}px` : width)
      : (height != null ? 'auto' : '200px')
  );

  const svgHeight = $derived(
    height != null && width == null
      ? (typeof height === 'number' ? `${height}px` : height)
      : 'auto'
  );
</script>

<svg
  style="color: {color}; width: {svgWidth}; height: {svgHeight};"
  viewBox="0 0 142.71001 74.062668"
  xmlns="http://www.w3.org/2000/svg"
  aria-label="Logo"
  role="img"
>
  <LogoPaths />
</svg>
