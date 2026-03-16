import { describe, it, expect } from 'vitest';
import { PLUGIN_REGISTRY, getAllPlugins, getPlugin } from './registry';

describe('Plugin Registry', () => {
	describe('PLUGIN_REGISTRY', () => {
		it('is a Map', () => {
			expect(PLUGIN_REGISTRY).toBeInstanceOf(Map);
		});

		it('contains at least one plugin', () => {
			expect(PLUGIN_REGISTRY.size).toBeGreaterThan(0);
		});

		it('indexes plugins by their slug', () => {
			for (const [slug, manifest] of PLUGIN_REGISTRY) {
				expect(manifest.slug).toBe(slug);
			}
		});

		it('every registered plugin has required manifest fields', () => {
			for (const manifest of PLUGIN_REGISTRY.values()) {
				expect(manifest.slug).toBeTruthy();
				expect(manifest.name).toBeTruthy();
				expect(manifest.version).toBeTruthy();
			}
		});
	});

	describe('getAllPlugins', () => {
		it('returns an array', () => {
			expect(Array.isArray(getAllPlugins())).toBe(true);
		});

		it('returns the same count as the registry', () => {
			expect(getAllPlugins().length).toBe(PLUGIN_REGISTRY.size);
		});

		it('every returned plugin appears in the registry', () => {
			for (const plugin of getAllPlugins()) {
				expect(PLUGIN_REGISTRY.has(plugin.slug)).toBe(true);
			}
		});
	});

	describe('getPlugin', () => {
		it('returns a plugin manifest for a known slug', () => {
			const slug = getAllPlugins()[0].slug;
			const result = getPlugin(slug);
			expect(result).toBeDefined();
			expect(result!.slug).toBe(slug);
		});

		it('returns undefined for an unknown slug', () => {
			expect(getPlugin('does-not-exist')).toBeUndefined();
		});
	});
});
