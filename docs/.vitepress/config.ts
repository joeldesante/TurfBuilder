import { defineConfig } from 'vitepress';
import { sidebar } from './sidebar';

export default defineConfig({
  title: 'TurfBuilder',
  description: 'Internal documentation — API reference, component library, and plugin system.',
  srcDir: '.',
  outDir: './.vitepress/dist',

  themeConfig: {
    logo: {
      light: '/logo-icon.svg',
      dark: '/logo-icon.svg',
      alt: 'TurfBuilder',
    },
    siteTitle: "TurfBuilder",

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
      message: 'Software released under GPL-3.0. Documentation made available under CC BY 4.0.',
      copyright: '<a href="https://docs.turfbuilder.org">TurfBuilder Documentation</a> © 2026 by <a href="https://github.com/joeldesante/TurfBuilder">TurfBuilder Contibutors &amp; Community</a> is licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>',
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
