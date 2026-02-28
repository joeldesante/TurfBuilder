import { describe, it, expect } from 'vitest';
import config from './config.js';

describe('application config', () => {
	it('has a non-empty application name', () => {
		expect(config.application_name.length).toBeGreaterThan(0);
	});

	it('has a logo source that starts with a leading slash', () => {
		expect(config.logo_src).toMatch(/^\//);
	});

	it('has at least one base origin configured', () => {
		expect(config.base_origins.length).toBeGreaterThan(0);
	});

	it('all base origins are https URLs', () => {
		for (const origin of config.base_origins) {
			expect(origin).toMatch(/^https:\/\//);
		}
	});

	it('has a theme object', () => {
		expect(config.theme).toBeDefined();
	});
});
