import { describe, it, expect } from 'vitest';
import { FADE_INTO_ROUTES, fadesInto, hidesLoaderItself } from './page-transitions';

describe('fadesInto', () => {
	it('fades into a listed route', () => {
		expect(FADE_INTO_ROUTES).toContain('/orgs');
		expect(fadesInto('/orgs')).toBe(true);
	});

	it('does not fade into a route that is not listed', () => {
		expect(fadesInto('/orgs/create')).toBe(false);
		expect(fadesInto('/o/[org_slug]/s')).toBe(false);
		expect(fadesInto('/infra')).toBe(false);
	});

	it('matches the whole route id, not a prefix or a substring', () => {
		expect(fadesInto('/orgs-archive')).toBe(false);
		expect(fadesInto('/x/orgs')).toBe(false);
	});

	it('does not fade when there is no route, such as a navigation to another site', () => {
		expect(fadesInto(null)).toBe(false);
		expect(fadesInto(undefined)).toBe(false);
		expect(fadesInto('')).toBe(false);
	});
});

describe('hidesLoaderItself', () => {
	it('is true for the org picker, whose list loads after it mounts', () => {
		expect(hidesLoaderItself('/orgs')).toBe(true);
	});

	it('is false for other pages and for no route', () => {
		expect(hidesLoaderItself('/orgs/create')).toBe(false);
		expect(hidesLoaderItself('/o/[org_slug]/s')).toBe(false);
		expect(hidesLoaderItself(null)).toBe(false);
		expect(hidesLoaderItself(undefined)).toBe(false);
	});
});
