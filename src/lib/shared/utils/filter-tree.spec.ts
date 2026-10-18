import { describe, expect, it } from 'vitest';
import type { Filter, FilterGroup } from '../types/filters';
import { getNode, isSameOrDescendant, moveNode } from './filter-tree';

const f = (item: string): Filter => ({ item, operation: 'equals', value: item });
const a = f('a');
const b = f('b');
const c = f('c');
const d = f('d');

const tree = (): FilterGroup => ({
	operator: 'AND',
	filters: [a, { operator: 'OR', filters: [b, c] }, d]
});

describe('filter tree', () => {
	it('finds a node by path', () => {
		expect(getNode(tree(), [1, 1])).toEqual(c);
		expect(getNode(tree(), [9])).toBeUndefined();
	});

	it('tells descendants from other paths', () => {
		expect(isSameOrDescendant([1, 0], [1])).toBe(true);
		expect(isSameOrDescendant([1], [1])).toBe(true);
		expect(isSameOrDescendant([2], [1])).toBe(false);
		expect(isSameOrDescendant([1], [1, 0])).toBe(false);
	});

	it('moves a filter later within its group', () => {
		// before d
		expect(moveNode(tree(), [0], [2]).filters.map((e) => ('item' in e ? e.item : 'group'))).toEqual([
			'group',
			'a',
			'd'
		]);
		// after d
		expect(moveNode(tree(), [0], [3]).filters.map((e) => ('item' in e ? e.item : 'group'))).toEqual([
			'group',
			'd',
			'a'
		]);
	});

	it('moves a filter earlier within its group', () => {
		expect(moveNode(tree(), [2], [0]).filters.map((e) => ('item' in e ? e.item : 'group'))).toEqual([
			'd',
			'a',
			'group'
		]);
	});

	it('moves a filter into a nested group', () => {
		const result = moveNode(tree(), [0], [1, 1]);
		expect(result.filters).toHaveLength(2);
		expect((result.filters[0] as FilterGroup).filters).toEqual([b, a, c]);
	});

	it('moves a filter out of a nested group', () => {
		const result = moveNode(tree(), [1, 0], [0]);
		expect(result.filters[0]).toEqual(b);
		expect((result.filters[2] as FilterGroup).filters).toEqual([c]);
	});

	it('moves a whole group', () => {
		const result = moveNode(tree(), [1], [0]);
		expect(result.filters[0]).toEqual({ operator: 'OR', filters: [b, c] });
		expect(result.filters.slice(1)).toEqual([a, d]);
	});

	it('moves a node into an empty group', () => {
		const root: FilterGroup = { operator: 'AND', filters: [a, { operator: 'OR', filters: [] }] };
		const result = moveNode(root, [0], [1, 0]);
		expect(result.filters).toEqual([{ operator: 'OR', filters: [a] }]);
	});

	it('refuses to move a group into itself or its descendants', () => {
		const root = tree();
		expect(moveNode(root, [1], [1, 0])).toBe(root);
		expect(moveNode(root, [1], [1, 1, 0])).toBe(root);
	});

	it('leaves the tree alone for the root, bad paths, and a drop onto its own spot', () => {
		const root = tree();
		expect(moveNode(root, [], [0])).toBe(root);
		expect(moveNode(root, [9], [0])).toBe(root);
		expect(moveNode(root, [0], [7, 0])).toBe(root);
		expect(moveNode(root, [0], [0])).toEqual(root);
		expect(moveNode(root, [0], [1])).toEqual(root);
	});

	it('does not mutate the input', () => {
		const root = tree();
		const snapshot = JSON.stringify(root);
		moveNode(root, [0], [1, 1]);
		expect(JSON.stringify(root)).toBe(snapshot);
	});
});
