#!/usr/bin/env node
// Dev utility: scaffold a new Storybook component or page in the stories tree.
// Usage: node scripts/new-component.js

import { createInterface } from 'readline';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

const COMPONENT_CATEGORIES = ['actions', 'data-display', 'data-inputs', 'feedback', 'layout'];

const categoryTitle = {
  actions: 'Actions',
  'data-display': 'Data Display',
  'data-inputs': 'Data Inputs',
  feedback: 'Feedback',
  layout: 'Layout',
};

function toKebab(name) {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function toPascal(str) {
  return str
    .split(/[-_\s]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function segmentsToTitle(segments) {
  return segments.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('/');
}

// ---- Templates ---------------------------------------------------------------

function componentSvelte(name) {
  return `<script lang="ts">
\tinterface Props {
\t\t// TODO: define props
\t}

\tconst {}: Props = $props();
</script>

<!-- TODO: implement ${name} -->
`;
}

function pageSvelte(name) {
  return `<script lang="ts">
\tinterface Props {
\t\torgSlug: string;
\t\tapplicationName: string;
\t}

\tconst { orgSlug, applicationName }: Props = $props();
</script>

<!-- TODO: implement ${name} -->
`;
}

function componentStories(name, storybookTitle) {
  return `<script module lang="ts">
\timport { defineMeta } from '@storybook/addon-svelte-csf';
\timport ${name} from './${name}.svelte';

\tconst { Story } = defineMeta({
\t\ttitle: '${storybookTitle}',
\t\tcomponent: ${name},
\t\ttags: ['autodocs']
\t});
</script>

<Story name="Default" />
`;
}

function pageStories(name, storybookTitle) {
  return `<script module lang="ts">
\timport { defineMeta } from '@storybook/addon-svelte-csf';
\timport ${name} from './${name}.svelte';

\tconst { Story } = defineMeta({
\t\ttitle: '${storybookTitle}',
\t\tcomponent: ${name},
\t\ttags: ['autodocs'],
\t\tparameters: {
\t\t\tlayout: 'fullscreen'
\t\t}
\t});
</script>

<Story
\tname="Default"
\targs={{
\t\torgSlug: 'example-org',
\t\tapplicationName: 'TurfBuilder'
\t}}
/>
`;
}

function componentSpec(name, importPath) {
  return `import { describe, test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ${name} from './${name}.svelte';

describe('${name}', () => {
\ttest('renders', async () => {
\t\tconst screen = render(${name}, {});
\t\t// TODO: add assertions
\t\tawait expect.element(screen.container.firstElementChild).toBeInTheDocument();
\t});
});
`;
}

function pageSpec(name) {
  return `import { describe, test, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import ${name} from './${name}.svelte';

const baseProps = {
\torgSlug: 'example-org',
\tapplicationName: 'TurfBuilder'
};

describe('${name}', () => {
\ttest('renders', async () => {
\t\trender(${name}, baseProps);
\t\t// TODO: add assertions
\t\tawait expect.element(page.getByRole('main')).toBeInTheDocument();
\t});
});
`;
}

// ---- Main --------------------------------------------------------------------

async function run() {
  console.log('\nNew Storybook component scaffold\n');

  // 1. Component name
  let rawName = (await ask('Component name (PascalCase, e.g. MyButton): ')).trim();
  if (!rawName) {
    console.error('Name is required.');
    rl.close();
    process.exit(1);
  }
  const name = toPascal(rawName);

  // 2. Type
  console.log('\nType:');
  console.log('  1) Page');
  console.log('  2) Component');
  console.log('  3) Custom path');
  const typeChoice = (await ask('Choice [1/2/3]: ')).trim();

  let dir, storybookTitle, isPage;

  if (typeChoice === '1') {
    // Page
    isPage = true;
    const routePath = (
      await ask(
        'Route path relative to src/stories/pages/ (e.g. o/s/members, leave blank for top-level): '
      )
    ).trim();
    const segments = routePath ? routePath.split('/').filter(Boolean) : [];
    dir = join(ROOT, 'src/stories/pages', ...segments, toKebab(name));
    const titleSegments = ['Pages', ...segments];
    storybookTitle = segmentsToTitle(titleSegments) + '/' + name;
  } else if (typeChoice === '2') {
    // Component
    isPage = false;
    console.log('\nCategory:');
    COMPONENT_CATEGORIES.forEach((c, i) => console.log(`  ${i + 1}) ${c}`));
    const catChoice = (await ask('Choice [1-5]: ')).trim();
    const idx = parseInt(catChoice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= COMPONENT_CATEGORIES.length) {
      console.error('Invalid category choice.');
      rl.close();
      process.exit(1);
    }
    const category = COMPONENT_CATEGORIES[idx];
    dir = join(ROOT, 'src/stories/components', category, toKebab(name));
    storybookTitle = `Components/${categoryTitle[category]}/${name}`;
  } else if (typeChoice === '3') {
    // Custom path
    isPage = false;
    const customPath = (
      await ask('Path relative to src/stories/ (e.g. pages/o/s/members/detail): ')
    ).trim();
    if (!customPath) {
      console.error('Path is required.');
      rl.close();
      process.exit(1);
    }
    dir = join(ROOT, 'src/stories', customPath);
    // Derive a best-effort title from the path
    const segments = customPath.split('/').filter(Boolean);
    storybookTitle = segments.map(toPascal).join('/') + '/' + name;
    const pageHint = (await ask('Treat as page (full-screen layout, org props)? [y/N]: '))
      .trim()
      .toLowerCase();
    isPage = pageHint === 'y' || pageHint === 'yes';
  } else {
    console.error('Invalid choice.');
    rl.close();
    process.exit(1);
  }

  rl.close();

  // 3. Write files
  if (existsSync(dir)) {
    console.error(`\nDirectory already exists: ${dir}`);
    process.exit(1);
  }

  mkdirSync(dir, { recursive: true });

  const files = [
    {
      path: join(dir, `${name}.svelte`),
      content: isPage ? pageSvelte(name) : componentSvelte(name),
    },
    {
      path: join(dir, `${name}.stories.svelte`),
      content: isPage ? pageStories(name, storybookTitle) : componentStories(name, storybookTitle),
    },
    {
      path: join(dir, `${name}.svelte.spec.ts`),
      content: isPage ? pageSpec(name) : componentSpec(name),
    },
  ];

  for (const file of files) {
    writeFileSync(file.path, file.content, 'utf8');
    const rel = file.path.replace(ROOT + '/', '');
    console.log(`  created  ${rel}`);
  }

  console.log(`\nDone. Edit the files in:\n  ${dir.replace(ROOT + '/', '')}/\n`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
