import { describe, it, expect } from 'vitest';
import { FADE_INTO_ROUTES, entersLoaderRoute, fadesInto, hidesLoaderItself } from './page-transitions';

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

describe('entersLoaderRoute', () => {
	const at = (id: string, params: Record<string, string> = {}) => ({ route: { id }, params });
	const dashboard = at('/o/[org_slug]/s', { org_slug: 'acme' });
	const voters = (section = '') =>
		at(`/o/[org_slug]/s/universe/buckets/[slug]${section}`, { org_slug: 'acme', slug: 'voters' });
	const donors = at('/o/[org_slug]/s/universe/buckets/[slug]/locations', { org_slug: 'acme', slug: 'donors' });

	it('raises the cover when opening a bucket from elsewhere, as from the sidebar', () => {
		expect(entersLoaderRoute(dashboard, voters())).toBe(true);
		expect(entersLoaderRoute(null, voters('/locations'))).toBe(true);
	});

	it('raises the cover when moving to another bucket', () => {
		expect(entersLoaderRoute(voters('/locations'), donors)).toBe(true);
	});

	it('does not raise it when moving around inside one bucket', () => {
		expect(entersLoaderRoute(voters('/locations'), voters('/people'))).toBe(false);
	});

	it('raises the cover when going back to the dashboard from a bucket or any other page', () => {
		expect(entersLoaderRoute(voters('/locations'), dashboard)).toBe(true);
		expect(entersLoaderRoute(at('/o/[org_slug]/s/members', { org_slug: 'acme' }), dashboard)).toBe(true);
	});

	it('leaves a dashboard reload with a new bucket or range to the dashboard itself', () => {
		expect(entersLoaderRoute(dashboard, dashboard)).toBe(false);
	});

	it('does not raise it for other pages', () => {
		expect(entersLoaderRoute(dashboard, at('/o/[org_slug]/s/members', { org_slug: 'acme' }))).toBe(false);
		expect(entersLoaderRoute(dashboard, at('/o/[org_slug]/s/universe/buckets/new', { org_slug: 'acme' }))).toBe(false);
	});
});
