# Plugins

Plugins extend TurfBuilder with org-specific features.
Installed per-org; can add staff pages, volunteer pages, API handlers, and event hooks.

> Register plugins in `src/plugins/registry.ts`

## Available Plugins

- [Rapid Response Alert Feed](./rapid-response-alert-feed.md) — Publish real-time alerts to canvassers in the field.

## Building a Plugin

Export a `PluginManifest` from `src/plugins/{slug}/index.ts` and register it.
See `src/plugins/types.ts` for the full interface.