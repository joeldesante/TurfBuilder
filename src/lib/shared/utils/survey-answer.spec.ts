import { describe, expect, it } from 'vitest';
import { decodeChoice, encodeChoice, formatAnswer, joinChoices, splitChoices } from './survey-answer';

describe('encodeChoice and decodeChoice', () => {
	it('escapes commas and percent signs, and nothing else', () => {
		expect(encodeChoice('Yes, definitely')).toBe('Yes%2C definitely');
		expect(encodeChoice('50% off')).toBe('50%25 off');
		expect(encodeChoice('Mail & phone')).toBe('Mail & phone');
	});

	it('round-trips any choice', () => {
		for (const choice of ['Yes, definitely', '50% off', '%2C', 'a,,b', '']) {
			expect(decodeChoice(encodeChoice(choice))).toBe(choice);
		}
	});
});

describe('joinChoices and splitChoices', () => {
	it('keeps a choice with a comma as one choice', () => {
		const stored = joinChoices(['Yes, definitely', 'Maybe']);

		expect(stored).toBe('Yes%2C definitely,Maybe');
		expect(splitChoices(stored)).toEqual(['Yes, definitely', 'Maybe']);
	});

	it('reads answers saved before choices were escaped', () => {
		expect(splitChoices('Mail,Phone')).toEqual(['Mail', 'Phone']);
	});

	it('reads no answer as no choices', () => {
		expect(splitChoices('')).toEqual([]);
		expect(splitChoices(null)).toEqual([]);
		expect(splitChoices(undefined)).toEqual([]);
		expect(joinChoices([])).toBe('');
	});
});

describe('formatAnswer', () => {
	it('lists the choices of a choose-many answer', () => {
		expect(formatAnswer('check', 'Yes%2C definitely,Maybe')).toBe('Yes, definitely, Maybe');
	});

	it('leaves other answers as they are', () => {
		expect(formatAnswer('text', 'Call me, please')).toBe('Call me, please');
		expect(formatAnswer('radio', '50%25')).toBe('50%25');
		expect(formatAnswer('text', null)).toBe('');
	});
});
