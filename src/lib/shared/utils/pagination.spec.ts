import { describe, it, expect } from 'vitest';
import { clampPage, pageLinks, pageOffset, requestedPage, PAGE_SIZE } from './pagination';

describe('clampPage', () => {
	it.each([
		['a page in range', 2, 250, 2],
		['past the end', 99, 250, 3],
		['zero', 0, 250, 1],
		['negative', -4, 250, 1],
		['not a number', NaN, 250, 1],
		['infinite', Infinity, 250, 1],
		['a fraction', 2.9, 250, 2],
		['any page of an empty collection', 5, 0, 1]
	])('handles %s', (_name, requested, total, expected) => {
		expect(clampPage(requested, total)).toBe(expected);
	});

	it('honors a page size', () => {
		expect(clampPage(9, 25, 10)).toBe(3);
	});
});

describe('pageOffset', () => {
	it('skips whole pages', () => {
		expect(pageOffset(3)).toBe(2 * PAGE_SIZE);
		expect(pageOffset(2, 10)).toBe(10);
	});
});

describe('requestedPage', () => {
	it('reads ?page=', () => {
		expect(requestedPage(new URL('https://x/?page=4'))).toBe(4);
	});

	it('is 0 when absent, which clamps to the first page', () => {
		expect(clampPage(requestedPage(new URL('https://x/')), 500)).toBe(1);
	});
});

describe('pageLinks', () => {
	it('lists every page when there are few', () => {
		expect(pageLinks(1, 1)).toEqual([1]);
		expect(pageLinks(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	it('keeps both ends and a window around the current page when there are many', () => {
		expect(pageLinks(10, 20)).toEqual([1, null, 9, 10, 11, null, 20]);
	});

	it('does not leave a gap where the window touches an end', () => {
		expect(pageLinks(1, 20)).toEqual([1, 2, null, 20]);
		expect(pageLinks(2, 20)).toEqual([1, 2, 3, null, 20]);
		expect(pageLinks(3, 20)).toEqual([1, 2, 3, 4, null, 20]);
		expect(pageLinks(20, 20)).toEqual([1, null, 19, 20]);
		expect(pageLinks(19, 20)).toEqual([1, null, 18, 19, 20]);
	});

	it('always includes the current page', () => {
		for (let page = 1; page <= 30; page++) expect(pageLinks(page, 30)).toContain(page);
	});
});
