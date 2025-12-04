<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Splash from './Splash.svelte';

  // More on how to set up stories at: https://storybook.js.org/docs/writing-stories
  const { Story } = defineMeta({
    title: 'Screen/Splash',
    component: Splash,
    tags: ['autodocs'],
    argTypes: {},
    args: {}
  });
</script>

<!-- More on writing stories with args: https://storybook.js.org/docs/writing-stories/args -->
<Story name="Splash Screen" />
