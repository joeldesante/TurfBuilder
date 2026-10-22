import { describe, expect, it } from 'vitest';
import { fillTemplate, templateVariables, unknownVariables } from './email-template';

describe('fillTemplate', () => {
	it('replaces variables and blanks unknown ones', () => {
		expect(fillTemplate('Hi {{name}}, {{missing}}!', { name: 'Ada' })).toBe('Hi Ada, !');
	});

	it('replaces every occurrence', () => {
		expect(fillTemplate('{{a}}{{a}}', { a: 'x' })).toBe('xx');
	});

	it('leaves braces that are not variables alone', () => {
		expect(fillTemplate('{ {a} } {{ a }}', { a: 'x' })).toBe('{ {a} } {{ a }}');
	});
});

describe('templateVariables', () => {
	it('lists each variable once, in order of first use', () => {
		expect(templateVariables('{{b}} {{a}} {{b}}')).toEqual(['b', 'a']);
	});
});

describe('unknownVariables', () => {
	it('finds variables across the subject and the body that are not provided', () => {
		expect(unknownVariables(['Hi {{name}}', '<a href="{{url}}">{{typo}}</a>'], ['name', 'url'])).toEqual(['typo']);
	});

	it('is empty when everything is provided', () => {
		expect(unknownVariables(['{{a}}'], ['a'])).toEqual([]);
	});
});
