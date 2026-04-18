import { defineConfig } from 'vitepress';
import { sidebar } from './sidebar';

export default defineConfig({
  title: 'TurfBuilder',
  description: 'Internal documentation — API reference, component library, and plugin system.',
  srcDir: '.',
  outDir: './.vitepress/dist',

  themeConfig: {
    logo: '🏠',
    siteTitle: 'TurfBuilder Docs',

    nav: [
      { text: 'API Reference', link: '/api/' },
      { text: 'Components', link: '/components/' },
      { text: 'Plugins', link: '/plugins/' },
    ],

    sidebar,

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Internal — not for public distribution.',
    },

    outline: {
      level: [2, 3],
      label: 'On this page',
    },
  },

  markdown: {
    lineNumbers: false,
  },
});
