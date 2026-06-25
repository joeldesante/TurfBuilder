<script module>
  export const meta = {
    title: 'Components/Layout/Logo',
    component: Logo,
    argTypes: {
      width: { control: 'number' },
      height: { control: 'number' },
      color: { control: 'color' },
    },
  };
</script>

<script lang="ts">
  import { Story, Template } from '@storybook/addon-svelte-csf';
  import Logo from './Logo.svelte';
</script>

<Template let:args>
  <Logo {...args} />
</Template>

<Story name="Default" />

<Story name="Width 300" args={{ width: 300 }} />

<Story name="Height 80" args={{ height: 80 }} />

<Story name="Custom Color" args={{ width: 250, color: '#1d4ed8' }} />

<Story name="Dark" args={{ width: 250, color: '#111827' }} />
