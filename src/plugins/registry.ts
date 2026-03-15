import type { PluginManifest } from './types';
import rapidResponseAlertFeedPlugin from './rapid-response-alert-feed/index';

const ALL_PLUGINS: PluginManifest[] = [
	rapidResponseAlertFeedPlugin,
];

export const PLUGIN_REGISTRY = new Map(ALL_PLUGINS.map((p) => [p.slug, p]));
export const getAllPlugins = () => ALL_PLUGINS;
export const getPlugin = (slug: string) => PLUGIN_REGISTRY.get(slug);
