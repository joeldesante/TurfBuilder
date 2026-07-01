#!/usr/bin/env tsx
/**
 * build-docs.ts
 *
 * Generates VitePress-compatible Markdown into docs/ from:
 *   - src/routes/**\/+server.ts  → docs/api/
 *   - src/stories/components     → docs/components/
 *   - src/plugins                → docs/plugins/
 *
 * Also writes docs/.vitepress/sidebar.ts (imported by config.ts).
 *
 * Usage:  npx tsx scripts/build-docs.ts
 *         npm run docs
 */

import { Project, SyntaxKind, type JSDoc, type SourceFile } from 'ts-morph';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from 'fs';
import { join, relative, dirname, basename, sep } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const DOCS = join(ROOT, 'docs');

// ─── Utilities ────────────────────────────────────────────────────────────────

function findFiles(dir: string, predicate: (name: string) => boolean): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) results.push(...findFiles(full, predicate));
      else if (predicate(entry.name)) results.push(full);
    }
  } catch {}
  return results;
}

function writeDoc(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
  console.log(`  ✓ ${relative(ROOT, path)}`);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function jsDocDescription(jsdoc: JSDoc | undefined): string {
  return jsdoc?.getDescription().trim() ?? '';
}

function jsDocTag(jsdoc: JSDoc | undefined, tag: string): string {
  const t = jsdoc?.getTags().find((t) => t.getTagName() === tag);
  if (!t) return '';
  // ts-morph strips {type} annotations from getComment() — reconstruct from raw text
  const raw = t.getText().replace(/\r?\n\s*\*\s*/g, ' ').trim();
  const match = raw.match(/@\w+\s+([\s\S]*)/);
  return match ? match[1].trim() : t.getComment()?.toString().trim() ?? '';
}

function jsDocTags(jsdoc: JSDoc | undefined, tag: string): string[] {
  return (
    jsdoc
      ?.getTags()
      .filter((t) => t.getTagName() === tag)
      .map((t) => t.getComment()?.toString().trim() ?? '') ?? []
  );
}

// ─── Route helpers ────────────────────────────────────────────────────────────

/** Convert an absolute +server.ts path to its public URL pattern. */
function routeToUrl(filePath: string): string {
  const rel = relative(join(SRC, 'routes'), dirname(filePath));
  return (
    '/' +
    rel
      .replace(/\\/g, '/')
      .replace(/\[\.\.\.([^\]]+)\]/g, '{...$1}')
      .replace(/\[([^\]]+)\]/g, '{$1}')
  );
}

/** Map a URL pattern to a documentation section key. */
function routeSection(url: string): string {
  if (url.startsWith('/api/')) return 'public';
  if (url.includes('/s/api/surveys')) return 'surveys';
  if (url.includes('/s/api/turf')) return 'turfs';
  if (url.includes('/s/api/members')) return 'members';
  if (url.includes('/s/api/roles')) return 'roles';
  if (url.includes('/s/api/invite-links')) return 'invites';
  if (url.includes('/s/api/plugins')) return 'plugins';
  if (url.includes('/map/') || url.endsWith('/join')) return 'volunteer';
  if (url.includes('/invite/')) return 'joining';
  return 'other';
}

// ─── Route parsing ────────────────────────────────────────────────────────────

interface BodyParam {
  name: string;
  type: string;
  required: boolean;
  desc: string;
}
interface QueryParam {
  name: string;
  type: string;
  desc: string;
}
interface Endpoint {
  method: string;
  path: string;
  description: string;
  auth: string;
  permissions: string[];
  body: BodyParam[];
  query: QueryParam[];
  returns: string;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/**
 * Parse @body / @query tag comment text into a structured param.
 * Expected format: `name {type} required - description`
 * or:              `name {type} - description`
 * or:              `name - description`
 */
function parseParamTag(text: string): { name: string; type: string; required: boolean; desc: string } {
  // name {type} required - desc
  const full = text.match(/^(\w+)\s+\{([^}]+)\}\s+(required)\s+-?\s*(.*)/i);
  if (full) return { name: full[1], type: full[2], required: true, desc: full[4].trim() };

  // name {type} - desc
  const typed = text.match(/^(\w+)\s+\{([^}]+)\}\s+-?\s*(.*)/);
  if (typed) return { name: typed[1], type: typed[2], required: false, desc: typed[3].trim() };

  // name - desc
  const simple = text.match(/^(\w+)\s+-?\s*(.*)/);
  if (simple) return { name: simple[1], type: 'any', required: false, desc: simple[2].trim() };

  return { name: text, type: 'any', required: false, desc: '' };
}

function getFirstJsDoc(sf: SourceFile, name: string): JSDoc | undefined {
  // Try function declaration
  const fn = sf.getFunction(name);
  if (fn?.isExported()) return fn.getJsDocs()[0];

  // Try exported variable (export const GET = ...)
  const vd = sf.getVariableDeclaration(name);
  const vs = vd?.getVariableStatement();
  if (vs?.isExported()) return vs.getJsDocs()[0];

  return undefined;
}

function isExported(sf: SourceFile, name: string): boolean {
  return (
    sf.getFunction(name)?.isExported() === true ||
    sf.getVariableDeclaration(name)?.getVariableStatement()?.isExported() === true
  );
}

function parseServerFile(filePath: string, project: Project): Endpoint[] {
  const sf = project.addSourceFileAtPath(filePath);
  const url = routeToUrl(filePath);
  const endpoints: Endpoint[] = [];

  for (const method of HTTP_METHODS) {
    if (!isExported(sf, method)) continue;

    const jsdoc = getFirstJsDoc(sf, method);
    const description = jsDocDescription(jsdoc);
    const auth = jsDocTag(jsdoc, 'auth');
    const permissions = jsDocTags(jsdoc, 'permission');
    const returns = jsDocTag(jsdoc, 'returns');

    const body: BodyParam[] = [];
    const query: QueryParam[] = [];

    for (const tag of jsdoc?.getTags() ?? []) {
      const n = tag.getTagName();
      const text = tag.getComment()?.toString().trim() ?? '';
      if (n === 'body') {
        const p = parseParamTag(text);
        body.push({ ...p });
      } else if (n === 'query') {
        const p = parseParamTag(text);
        query.push({ name: p.name, type: p.type, desc: p.desc });
      }
    }

    endpoints.push({ method, path: url, description, auth, permissions, body, query, returns });
  }

  project.removeSourceFile(sf);
  return endpoints;
}

// ─── Component parsing ────────────────────────────────────────────────────────

interface ComponentProp {
  name: string;
  type: string;
  required: boolean;
  default: string;
  description: string;
}
interface ComponentDoc {
  name: string;
  filePath: string;
  category: string;
  description: string;
  props: ComponentProp[];
}

function parseSvelteComponent(filePath: string, project: Project): ComponentDoc | null {
  const source = readFileSync(filePath, 'utf-8');

  // Extract <script lang="ts"> or <script lang="ts" ...>
  const scriptMatch = source.match(/<script\b[^>]*\blang=["']ts["'][^>]*>([\s\S]*?)<\/script>/);
  if (!scriptMatch) return null;

  const sf = project.createSourceFile('__svelte_virtual__.ts', scriptMatch[1], { overwrite: true });

  const name = basename(filePath, '.svelte');
  const relFromComponents = relative(join(SRC, 'stories', 'components'), filePath);
  const category = relFromComponents.split(sep)[0];

  // Component-level description: JSDoc on the Props interface
  const propsInterface = sf.getInterface('Props');
  const description = propsInterface ? jsDocDescription(propsInterface.getJsDocs()[0]) : '';

  if (!propsInterface) {
    project.removeSourceFile(sf);
    return { name, filePath, category, description, props: [] };
  }

  // Collect defaults from $props() destructuring
  const defaults: Record<string, string> = {};
  for (const vd of sf.getVariableDeclarations()) {
    const init = vd.getInitializer();
    if (!init?.getText().includes('$props')) continue;

    const nameNode = vd.getNameNode();
    if (nameNode.getKind() !== SyntaxKind.ObjectBindingPattern) continue;

    for (const el of nameNode.asKindOrThrow(SyntaxKind.ObjectBindingPattern).getElements()) {
      const defaultInit = el.getInitializer();
      if (!defaultInit) continue;
      // The property name in the binding may be quoted (e.g. 'aria-label': ariaLabel)
      const rawKey =
        el.getPropertyNameNode()?.getText() ?? el.getNameNode().getText();
      defaults[rawKey.replace(/['"]/g, '')] = defaultInit.getText();
    }
  }

  // Extract props
  const props: ComponentProp[] = [];
  for (const member of propsInterface.getProperties()) {
    const rawName = member.getName();
    if (rawName.startsWith('[')) continue; // skip index signatures

    const jsdoc = member.getJsDocs()[0];
    const propDesc = jsDocDescription(jsdoc);
    const defaultTag = jsDocTag(jsdoc, 'default');
    const cleanName = rawName.replace(/['"]/g, '');

    // Use ts-morph type text, falling back to the raw text of the type node
    let type: string;
    try {
      type = member.getType().getText(member);
    } catch {
      type = member.getTypeNode()?.getText() ?? 'unknown';
    }
    // Trim very long union types
    if (type.length > 80) type = type.slice(0, 77) + '...';

    props.push({
      name: cleanName,
      type,
      required: !member.hasQuestionToken(),
      default: defaultTag || defaults[cleanName] || '',
      description: propDesc,
    });
  }

  project.removeSourceFile(sf);
  return { name, filePath, category, description, props };
}

// ─── Plugin parsing ───────────────────────────────────────────────────────────

interface PluginDoc {
  slug: string;
  name: string;
  description: string;
  version: string;
  staffPages: string[];
  volunteerPages: string[];
  hooks: string[];
  apiHandlers: string[];
}

function parsePlugin(filePath: string, project: Project): PluginDoc | null {
  const sf = project.addSourceFileAtPath(filePath);

  let slug = '', name = '', description = '', version = '';
  const staffPages: string[] = [];
  const volunteerPages: string[] = [];
  const hooks: string[] = [];
  const apiHandlers: string[] = [];

  for (const vd of sf.getVariableDeclarations()) {
    const init = vd.getInitializer();
    if (init?.getKind() !== SyntaxKind.ObjectLiteralExpression) continue;

    const obj = init.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    // Check this is a plugin manifest by looking for the 'slug' key
    const hasSlug = obj.getProperties().some(
      (p) => p.getKind() === SyntaxKind.PropertyAssignment && (p as any).getName() === 'slug'
    );
    if (!hasSlug) continue;

    for (const prop of obj.getProperties()) {
      if (prop.getKind() !== SyntaxKind.PropertyAssignment) continue;
      const pa = prop.asKindOrThrow(SyntaxKind.PropertyAssignment);
      const key = pa.getName();
      const valText = pa.getInitializer()?.getText() ?? '';

      if (key === 'slug') slug = valText.replace(/['"]/g, '');
      if (key === 'name') name = valText.replace(/['"]/g, '');
      if (key === 'description') description = valText.replace(/['"]/g, '');
      if (key === 'version') version = valText.replace(/['"]/g, '');

      if (key === 'pages' || key === 'volunteerPages') {
        const inner = pa.getInitializer();
        if (inner?.getKind() === SyntaxKind.ObjectLiteralExpression) {
          const keys = inner
            .asKindOrThrow(SyntaxKind.ObjectLiteralExpression)
            .getProperties()
            .map((p) => (p as any).getName?.() ?? '')
            .filter(Boolean);
          if (key === 'pages') staffPages.push(...keys);
          else volunteerPages.push(...keys);
        }
      }

      if (key === 'hooks' || key === 'apiHandlers') {
        const inner = pa.getInitializer();
        if (inner?.getKind() === SyntaxKind.ObjectLiteralExpression) {
          const keys = inner
            .asKindOrThrow(SyntaxKind.ObjectLiteralExpression)
            .getProperties()
            .map((p) => (p as any).getName?.() ?? '')
            .filter(Boolean);
          if (key === 'hooks') hooks.push(...keys);
          else apiHandlers.push(...keys);
        }
      }
    }
  }

  project.removeSourceFile(sf);
  if (!slug) return null;
  return { slug, name, description, version, staffPages, volunteerPages, hooks, apiHandlers };
}

// ─── Markdown rendering ───────────────────────────────────────────────────────

const METHOD_BADGE: Record<string, string> = {
  GET: '![GET](https://img.shields.io/badge/GET-22c55e?style=flat-square)',
  POST: '![POST](https://img.shields.io/badge/POST-3b82f6?style=flat-square)',
  PUT: '![PUT](https://img.shields.io/badge/PUT-f59e0b?style=flat-square)',
  PATCH: '![PATCH](https://img.shields.io/badge/PATCH-a855f7?style=flat-square)',
  DELETE: '![DELETE](https://img.shields.io/badge/DELETE-ef4444?style=flat-square)',
};

const AUTH_LABEL: Record<string, string> = {
  public: 'Public — no authentication required',
  org: 'Org member',
  staff: 'Staff',
  owner: 'Owner only',
};

const SECTION_META: Record<string, { title: string; description: string }> = {
  public: {
    title: 'Public API',
    description:
      'Unauthenticated endpoints for geographic location data. Used by the volunteer map to populate visible addresses.',
  },
  volunteer: {
    title: 'Volunteer API',
    description:
      'Endpoints used by canvassers in the field. Require org membership but not staff access.',
  },
  surveys: {
    title: 'Surveys',
    description: 'Staff endpoints for creating and managing survey templates and questions.',
  },
  turfs: {
    title: 'Turfs',
    description: 'Staff endpoints for creating canvassing territories from GeoJSON polygons.',
  },
  members: {
    title: 'Members',
    description: 'Staff endpoints for managing organization membership and role assignments.',
  },
  roles: {
    title: 'Roles & Permissions',
    description: 'Owner-only endpoints for managing custom staff roles and their permission sets.',
  },
  invites: {
    title: 'Invite Links',
    description:
      'Owner-only endpoints for token-based and slug-based org invite links.',
  },
  plugins: {
    title: 'Plugins',
    description:
      'Staff endpoints for installing, configuring, and routing to plugin-defined API handlers.',
  },
  joining: {
    title: 'Joining',
    description: 'Endpoints for resolving invite links and joining organizations.',
  },
  other: {
    title: 'Other',
    description: 'Miscellaneous endpoints.',
  },
};

function renderEndpoint(ep: Endpoint): string {
  const lines: string[] = [];
  const badge = METHOD_BADGE[ep.method] ?? ep.method;

  lines.push(`### ${badge} \`${ep.path}\``);
  lines.push('');

  if (ep.description) {
    lines.push(ep.description);
    lines.push('');
  }

  if (ep.auth || ep.permissions.length > 0) {
    if (ep.auth) lines.push(`**Auth:** ${AUTH_LABEL[ep.auth] ?? ep.auth}  `);
    if (ep.permissions.length > 0)
      lines.push(`**Permission:** ${ep.permissions.map((p) => `\`${p}\``).join(', ')}`);
    lines.push('');
  }

  if (ep.query.length > 0) {
    lines.push('**Query Parameters**');
    lines.push('');
    lines.push('| Name | Type | Description |');
    lines.push('|------|------|-------------|');
    for (const p of ep.query) lines.push(`| \`${p.name}\` | \`${p.type}\` | ${p.desc} |`);
    lines.push('');
  }

  if (ep.body.length > 0) {
    lines.push('**Request Body**');
    lines.push('');
    lines.push('| Field | Type | Required | Description |');
    lines.push('|-------|------|:--------:|-------------|');
    for (const p of ep.body)
      lines.push(`| \`${p.name}\` | \`${p.type}\` | ${p.required ? '✓' : ''} | ${p.desc} |`);
    lines.push('');
  }

  if (ep.returns) {
    lines.push('**Response**');
    lines.push('');
    lines.push(ep.returns);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

function renderComponentDoc(comp: ComponentDoc): string {
  const importPath = `$components/${relative(
    join(SRC, 'stories', 'components'),
    comp.filePath
  ).replace(/\\/g, '/')}`;

  const lines: string[] = [];
  lines.push(`## ${comp.name}`);
  lines.push('');
  if (comp.description) { lines.push(comp.description); lines.push(''); }
  lines.push(`**Import:** \`${importPath}\``);
  lines.push('');

  if (comp.props.length > 0) {
    lines.push('**Props**');
    lines.push('');
    lines.push('| Prop | Type | Default | Description |');
    lines.push('|------|------|---------|-------------|');
    for (const p of comp.props) {
      const def = p.default
        ? `\`${p.default}\``
        : p.required
        ? '**required**'
        : '—';
      lines.push(`| \`${p.name}\` | \`${p.type}\` | ${def} | ${p.description} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

// ─── Color Tokens ─────────────────────────────────────────────────────────────

interface ColorToken {
  name: string;
  hex: string;
  description: string;
}

interface ColorGroup {
  title: string;
  description: string;
  tokens: ColorToken[];
}

function swatch(hex: string): string {
  const needsBorder = ['#ffffff', '#fafafa', '#f4f4f5', '#e4e4e7', '#d4d4d8', '#ccfbf1', '#d1fae5', '#dbeafe', '#dcfce7', '#fef3c7', '#fee2e2'].includes(hex);
  const border = needsBorder ? '#a1a1aa' : 'transparent';
  return `<span style="display:inline-block;width:1.1rem;height:1.1rem;border-radius:3px;background:${hex};border:1px solid ${border};vertical-align:middle"></span>`;
}

function renderColorTokensDoc(): string {
  const groups: ColorGroup[] = [
    {
      title: 'Primary',
      description: 'The main brand color and its companions. Use for primary actions, interactive elements, and key brand accents.',
      tokens: [
        { name: 'primary',                hex: '#047857', description: 'Main brand color. Use for primary buttons, links, active nav items, and focus rings.' },
        { name: 'on-primary',             hex: '#ffffff', description: 'Text and icons placed directly on a `primary` background.' },
        { name: 'primary-container',      hex: '#d1fae5', description: 'Softer primary-tinted background. Use for chips, selected rows, and highlights.' },
        { name: 'on-primary-container',   hex: '#064e3b', description: 'Text and icons placed on a `primary-container` background.' },
      ],
    },
    {
      title: 'Secondary',
      description: 'A complementary neutral accent. Use for less prominent interactive elements and supporting UI.',
      tokens: [
        { name: 'secondary',              hex: '#52525b', description: 'Secondary action color. Use for secondary buttons and less prominent controls.' },
        { name: 'on-secondary',           hex: '#ffffff', description: 'Text and icons placed on a `secondary` background.' },
        { name: 'secondary-container',    hex: '#d4d4d8', description: 'Soft secondary tint. Use for tags, secondary chips, or filter badges.' },
        { name: 'on-secondary-container', hex: '#18181b', description: 'Text and icons placed on a `secondary-container` background.' },
      ],
    },
    {
      title: 'Tertiary',
      description: 'An optional third accent for decorative or distinguishing UI. Use sparingly.',
      tokens: [
        { name: 'tertiary',               hex: '#0d9488', description: 'Tertiary accent. Use to visually distinguish a third category or accent alongside primary and secondary.' },
        { name: 'on-tertiary',            hex: '#ffffff', description: 'Text and icons placed on a `tertiary` background.' },
        { name: 'tertiary-container',     hex: '#ccfbf1', description: 'Soft tertiary tint. Use for decorative section backgrounds or grouping highlights.' },
        { name: 'on-tertiary-container',  hex: '#134e4a', description: 'Text and icons placed on a `tertiary-container` background.' },
      ],
    },
    {
      title: 'Error',
      description: 'Signals destructive or invalid states — validation failures, delete confirmations, and critical alerts.',
      tokens: [
        { name: 'error',                  hex: '#dc2626', description: 'Use for error text, destructive action buttons, and form validation failure indicators.' },
        { name: 'on-error',               hex: '#ffffff', description: 'Text and icons placed on an `error` background.' },
        { name: 'error-container',        hex: '#fee2e2', description: 'Soft error tint. Use for inline error banners, invalid field backgrounds, or alert boxes.' },
        { name: 'on-error-container',     hex: '#7f1d1d', description: 'Text and icons placed on an `error-container` background.' },
      ],
    },
    {
      title: 'Info',
      description: 'Signals informational content that is neutral and non-urgent.',
      tokens: [
        { name: 'info',                   hex: '#2563eb', description: 'Use for informational badges, help text callouts, and status indicators.' },
        { name: 'on-info',                hex: '#ffffff', description: 'Text and icons placed on an `info` background.' },
        { name: 'info-container',         hex: '#dbeafe', description: 'Soft info tint. Use for info banners, instructional callout boxes, or tooltip backgrounds.' },
        { name: 'on-info-container',      hex: '#1e3a8a', description: 'Text and icons placed on an `info-container` background.' },
      ],
    },
    {
      title: 'Success',
      description: 'Signals a positive, completed, or confirmed state.',
      tokens: [
        { name: 'success',                hex: '#16a34a', description: 'Use for success toasts, completion checkmarks, and positive status indicators.' },
        { name: 'on-success',             hex: '#ffffff', description: 'Text and icons placed on a `success` background.' },
        { name: 'success-container',      hex: '#dcfce7', description: 'Soft success tint. Use for success banners or confirmed-state row highlights.' },
        { name: 'on-success-container',   hex: '#14532d', description: 'Text and icons placed on a `success-container` background.' },
      ],
    },
    {
      title: 'Warning',
      description: 'Signals a cautionary state that needs attention but is not a blocking error.',
      tokens: [
        { name: 'warning',                hex: '#d97706', description: 'Use for warning badges, advisory alerts, and caution indicators.' },
        { name: 'on-warning',             hex: '#ffffff', description: 'Text and icons placed on a `warning` background.' },
        { name: 'warning-container',      hex: '#fef3c7', description: 'Soft warning tint. Use for advisory banners or rows requiring user attention.' },
        { name: 'on-warning-container',   hex: '#78350f', description: 'Text and icons placed on a `warning-container` background.' },
      ],
    },
    {
      title: 'Surface',
      description: 'The layered neutral backgrounds that make up the app shell. Based on Material 3 surface roles — higher "container" levels sit visually higher in the hierarchy.',
      tokens: [
        { name: 'surface',                      hex: '#fafafa', description: 'Default page/app background. Applied to `<body>` and full-bleed layouts.' },
        { name: 'on-surface',                   hex: '#18181b', description: 'Primary body text and icons on any surface background.' },
        { name: 'surface-subtle',               hex: '#f4f4f5', description: 'Slightly elevated surface. Use for sidebar backgrounds, striped table rows, or inset areas.' },
        { name: 'on-surface-subtle',            hex: '#52525b', description: 'De-emphasized text — placeholders, secondary labels, metadata.' },
        { name: 'surface-dim',                  hex: '#f4f4f5', description: 'Dimmed surface for disabled regions or content behind a scrim.' },
        { name: 'surface-bright',               hex: '#ffffff', description: 'Brightest surface. Use for modal backgrounds and the top layer of stacked cards.' },
        { name: 'surface-container-lowest',     hex: '#ffffff', description: 'Lowest elevation container. Use for inset or recessed content wells.' },
        { name: 'surface-container-low',        hex: '#fafafa', description: 'Low elevation container. Use for list backgrounds or page section fills.' },
        { name: 'surface-container',            hex: '#f4f4f5', description: 'Standard card and panel background.' },
        { name: 'surface-container-high',       hex: '#e4e4e7', description: 'Elevated card background. Use for hover states or raised panels.' },
        { name: 'surface-container-highest',    hex: '#d4d4d8', description: 'Highest elevation container. Use for dropdown menus, popovers, or floating elements.' },
      ],
    },
    {
      title: 'Outline',
      description: 'Border and divider colors.',
      tokens: [
        { name: 'outline',        hex: '#d4d4d8', description: 'Standard border for inputs, cards, and dividers.' },
        { name: 'outline-subtle', hex: '#e4e4e7', description: 'Subtle divider lines. Use for section separators and de-emphasized borders.' },
      ],
    },
    {
      title: 'Inverse',
      description: 'Flipped-theme surfaces for snackbars, toasts, and tooltip-style elements that must stand out against the default background.',
      tokens: [
        { name: 'inverse-surface',    hex: '#27272a', description: 'Dark background for toasts and snackbars in light mode.' },
        { name: 'inverse-on-surface', hex: '#f4f4f5', description: 'Text on an `inverse-surface` background.' },
        { name: 'inverse-primary',    hex: '#6ee7b7', description: 'Primary accent color rendered on an inverse surface (e.g. a link inside a dark toast).' },
      ],
    },
    {
      title: 'Location Status',
      description: 'Semantic colors for canvassing location markers on the map and in lists. Each has an `on-*` companion for text/icon contrast.',
      tokens: [
        { name: 'location-unvisited',        hex: '#3b82f6', description: 'Location has not yet been visited during this canvass.' },
        { name: 'on-location-unvisited',     hex: '#ffffff', description: 'Text and icons on a `location-unvisited` background.' },
        { name: 'location-contacted',        hex: '#15803d', description: 'Canvasser made successful contact at this location.' },
        { name: 'on-location-contacted',     hex: '#ffffff', description: 'Text and icons on a `location-contacted` background.' },
        { name: 'location-no-contact',       hex: '#a1a1aa', description: 'Canvasser visited but no one answered.' },
        { name: 'on-location-no-contact',    hex: '#27272a', description: 'Text and icons on a `location-no-contact` background.' },
        { name: 'location-hostile',          hex: '#991b1b', description: 'Location is marked do-not-contact or was hostile.' },
        { name: 'on-location-hostile',       hex: '#ffffff', description: 'Text and icons on a `location-hostile` background.' },
      ],
    },
    {
      title: 'Utility',
      description: 'Miscellaneous tokens for overlays and shadows.',
      tokens: [
        { name: 'scrim',  hex: 'rgba(0,0,0,0.5)', description: 'Semi-transparent black overlay used behind modals, drawers, and bottom sheets.' },
        { name: 'shadow', hex: '#000000',          description: 'Color used for drop shadows on elevated surfaces.' },
      ],
    },
  ];

  const lines: string[] = [
    '# Color Tokens',
    '',
    "TurfBuilder's color system is based on [Material 3 color roles](https://m3.material.io/styles/color/roles). Every token is available as a Tailwind utility class (`bg-*`, `text-*`, `border-*`) and as a CSS custom property (`var(--token-name)`).",
    '',
    'The theme switches automatically based on OS preference. Dark mode values are defined in `src/app.css` under `:root[data-theme=\'dark\']`.',
    '',
  ];

  for (const group of groups) {
    lines.push(`## ${group.title}`);
    lines.push('');
    lines.push(group.description);
    lines.push('');
    lines.push('| Token | &nbsp; | Description |');
    lines.push('|-------|:------:|-------------|');
    for (const token of group.tokens) {
      lines.push(`| \`${token.name}\` | ${swatch(token.hex)} | ${token.description} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📚 Building TurfBuilder docs…\n');

  const project = new Project({
    tsConfigFilePath: join(ROOT, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  // ── API routes ─────────────────────────────────────────────────────────────
  console.log('📡 Parsing API routes…');

  const serverFiles = findFiles(join(SRC, 'routes'), (n) => n === '+server.ts');
  const bySection: Record<string, Endpoint[]> = {};

  for (const file of serverFiles) {
    for (const ep of parseServerFile(file, project)) {
      const sec = routeSection(ep.path);
      (bySection[sec] ??= []).push(ep);
    }
  }

  const apiSections: string[] = [];
  for (const [sec, endpoints] of Object.entries(bySection)) {
    const meta = SECTION_META[sec] ?? { title: capitalize(sec), description: '' };
    const lines: string[] = [`# ${meta.title}`, '', meta.description, '', '---', ''];
    for (const ep of endpoints) lines.push(renderEndpoint(ep));
    writeDoc(join(DOCS, 'api', `${sec}.md`), lines.join('\n'));
    apiSections.push(sec);
  }

  writeDoc(
    join(DOCS, 'api', 'index.md'),
    [
      '# API Reference',
      '',
      'TurfBuilder exposes a set of internal JSON APIs consumed by the web client.',
      'All org-scoped routes are prefixed with `/o/{org_slug}/`.',
      '',
      '## Auth levels',
      '',
      '| Level | Description |',
      '|-------|-------------|',
      '| Public | No authentication required |',
      '| Org Member | Authenticated user and org member |',
      '| Staff | Org member with a staff role |',
      '| Owner | Staff member with `is_owner = true` |',
      '',
      '## Sections',
      '',
      ...Object.entries(SECTION_META)
        .filter(([s]) => bySection[s])
        .map(([s, m]) => `- [${m.title}](./${s}.md) — ${m.description}`),
    ].join('\n')
  );

  // ── Components ─────────────────────────────────────────────────────────────
  console.log('\n🎨 Parsing components…');

  const svelteFiles = findFiles(
    join(SRC, 'stories', 'components'),
    (n) => n.endsWith('.svelte') && !n.endsWith('.stories.svelte')
  ).filter((f) => !f.includes('__tests__'));

  const byCategory: Record<string, ComponentDoc[]> = {};
  for (const file of svelteFiles) {
    const doc = parseSvelteComponent(file, project);
    if (!doc) continue;
    (byCategory[doc.category] ??= []).push(doc);
  }

  for (const [cat, components] of Object.entries(byCategory)) {
    const lines = [`# ${capitalize(cat)} Components`, ''];
    for (const comp of components) lines.push(renderComponentDoc(comp));
    writeDoc(join(DOCS, 'components', `${cat}.md`), lines.join('\n'));
  }

  writeDoc(
    join(DOCS, 'components', 'index.md'),
    [
      '# Component Library',
      '',
      'Reusable Svelte 5 UI primitives used throughout TurfBuilder.',
      'All components use runes syntax — `$props()`, `$state()`, `$derived()`, etc.',
      '',
      '> **Import alias:** `$components` → `src/stories/components`',
      '',
      '## Categories',
      '',
      ...Object.keys(byCategory).map((c) => `- [${capitalize(c)}](./${c}.md)`),
    ].join('\n')
  );

  // ── Plugins ────────────────────────────────────────────────────────────────
  console.log('\n🧩 Parsing plugins…');

  const pluginFiles = findFiles(join(SRC, 'plugins'), (n) => n === 'index.ts').filter(
    (f) => !f.includes('.spec.')
  );

  const pluginDocs: PluginDoc[] = [];
  for (const file of pluginFiles) {
    const doc = parsePlugin(file, project);
    if (doc) pluginDocs.push(doc);
  }

  for (const plugin of pluginDocs) {
    const lines: string[] = [
      `# ${plugin.name}`,
      '',
      `**Slug:** \`${plugin.slug}\`  `,
      `**Version:** \`${plugin.version}\``,
      '',
      plugin.description,
      '',
      '## Pages',
      '',
      '| Surface | Route keys |',
      '|---------|------------|',
      `| Staff | ${plugin.staffPages.length ? plugin.staffPages.map((p) => `\`${p}\``).join(', ') : '—'} |`,
      `| Volunteer | ${plugin.volunteerPages.length ? plugin.volunteerPages.map((p) => `\`${p}\``).join(', ') : '—'} |`,
      '',
    ];

    if (plugin.apiHandlers.length > 0) {
      lines.push('## API Handlers');
      lines.push('');
      lines.push(`Accessible via \`/o/{org_slug}/s/api/plugins/${plugin.slug}/{path}\``);
      lines.push('');
      for (const h of plugin.apiHandlers) lines.push(`- \`${h}\``);
      lines.push('');
    }

    if (plugin.hooks.length > 0) {
      lines.push('## Hooks');
      lines.push('');
      for (const h of plugin.hooks) lines.push(`- \`${h}\``);
      lines.push('');
    }

    writeDoc(join(DOCS, 'plugins', `${plugin.slug}.md`), lines.join('\n'));
  }

  writeDoc(
    join(DOCS, 'plugins', 'index.md'),
    [
      '# Plugins',
      '',
      'Plugins extend TurfBuilder with org-specific features.',
      'Installed per-org; can add staff pages, volunteer pages, API handlers, and event hooks.',
      '',
      '> Register plugins in `src/plugins/registry.ts`',
      '',
      '## Available Plugins',
      '',
      ...pluginDocs.map((p) => `- [${p.name}](./${p.slug}.md) — ${p.description}`),
      '',
      '## Building a Plugin',
      '',
      'Export a `PluginManifest` from `src/plugins/{slug}/index.ts` and register it.',
      'See `src/plugins/types.ts` for the full interface.',
    ].join('\n')
  );

  // ── Color Tokens ──────────────────────────────────────────────────────────
  console.log('\n🎨 Writing color tokens…');
  writeDoc(join(DOCS, 'design', 'colors.md'), renderColorTokensDoc());

  // ── VitePress sidebar.ts ──────────────────────────────────────────────────
  console.log('\n📑 Writing sidebar.ts…');

  const sectionOrder = ['public', 'volunteer', 'surveys', 'turfs', 'members', 'roles', 'invites', 'plugins', 'joining', 'other'];

  const sidebarObj = [
    {
      text: 'Getting Started',
      collapsed: false,
      items: [
        { text: 'Setup', link: '/getting-started' },
      ],
    },
    {
      text: 'Design',
      collapsed: false,
      items: [
        { text: 'Color Tokens', link: '/design/colors' },
      ],
    },
    {
      text: 'API Reference',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/api/' },
        ...sectionOrder
          .filter((s) => bySection[s])
          .map((s) => ({
            text: SECTION_META[s]?.title ?? capitalize(s),
            link: `/api/${s}`,
          })),
      ],
    },
    {
      text: 'Component Library',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/components/' },
        ...Object.keys(byCategory).map((c) => ({
          text: capitalize(c),
          link: `/components/${c}`,
        })),
      ],
    },
    {
      text: 'Plugins',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/plugins/' },
        ...pluginDocs.map((p) => ({
          text: p.name,
          link: `/plugins/${p.slug}`,
        })),
      ],
    },
  ];

  writeDoc(
    join(DOCS, '.vitepress', 'sidebar.ts'),
    `// Auto-generated by scripts/build-docs.ts — do not edit manually.\nimport type { DefaultTheme } from 'vitepress';\n\nexport const sidebar: DefaultTheme.SidebarItem[] = ${JSON.stringify(sidebarObj, null, 2)};\n`
  );

  // ── Single-file endpoint reference ────────────────────────────────────────
  console.log('\n📄 Writing all-endpoints.md…');

  const allSections = [
    '# All Endpoints\n',
    ...sectionOrder
      .filter((s) => bySection[s])
      .map((s) => readFileSync(join(DOCS, 'api', `${s}.md`), 'utf-8')),
  ];

  writeDoc(join(DOCS, 'all-endpoints.md'), allSections.join('\n'));

  console.log('\n✅ Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
