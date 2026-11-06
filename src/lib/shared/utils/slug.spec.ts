import { describe, expect, it } from 'vitest';
import { slugFromName } from './slug';

describe('slugFromName', () => {
	it('lowercases and joins words with hyphens', () => {
		expect(slugFromName('Main Street Canvass')).toBe('main-street-canvass');
	});

	it('collapses runs of other characters into one hyphen', () => {
		expect(slugFromName('North  &  South -- Ward 3')).toBe('north-south-ward-3');
	});

	it('drops hyphens at either end', () => {
		expect(slugFromName('  --Hello, World!--  ')).toBe('hello-world');
	});

	it('is empty when there are no letters or numbers', () => {
		expect(slugFromName('!!! ---')).toBe('');
	});
});
