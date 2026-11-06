<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import LogoPaths from './LogoPaths.svelte';

  const { Story } = defineMeta({
    title: 'Components/Layout/LogoPaths',
    component: LogoPaths,
    tags: ['autodocs'],
    parameters: {
      docs: {
        subtitle:
          'The bare shapes of the text logo, for composing inside your own svg (see Logo and Loading).'
      }
    }
  });
</script>

<Story name="Default">
  {#snippet template()}
    <svg viewBox="0 0 142.71001 74.062668" class="w-64 text-primary" role="img" aria-label="Logo">
      <LogoPaths />
    </svg>
  {/snippet}
</Story>
