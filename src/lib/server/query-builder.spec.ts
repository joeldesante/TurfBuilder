import { describe, expect, test } from 'vitest';
import { schemaToSqlQuery } from './query-builder';

describe('schemaToSqlQuery', () => {
	test('basic select, no where', () => {
		const result = schemaToSqlQuery({
			queries: [{ select: ['id', 'name'], from: 'users' }]
		});
		expect(result).toEqual([{ query: 'SELECT id, name FROM users;', parameters: [] }]);
	});

	test('single AND condition', () => {
		const result = schemaToSqlQuery({
			queries: [{
				select: ['id', 'name'],
				from: 'users',
				where: {
					type: 'group', connector: 'AND', negate: false,
					children: [{ type: 'condition', column: 'id', op: '=', negate: false, value: 1 }]
				}
			}]
		});
		expect(result).toEqual([{ query: 'SELECT id, name FROM users WHERE id = $1;', parameters: [1] }]);
	});

	test('multiple AND conditions', () => {
		const result = schemaToSqlQuery({
			queries: [{
				select: ['id', 'name'],
				from: 'users',
				where: {
					type: 'group', connector: 'AND', negate: false,
					children: [
						{ type: 'condition', column: 'id', op: '=', negate: false, value: 1 },
						{ type: 'condition', column: 'name', op: '=', negate: false, value: 'John Pork' },
					]
				}
			}]
		});
		expect(result).toEqual([{ query: 'SELECT id, name FROM users WHERE (id = $1 AND name = $2);', parameters: [1, 'John Pork'] }]);
	});

	test('OR conditions', () => {
		const result = schemaToSqlQuery({
			queries: [{
				select: ['id'],
				from: 'users',
				where: {
					type: 'group', connector: 'OR', negate: false,
					children: [
						{ type: 'condition', column: 'role', op: '=', negate: false, value: 'admin' },
						{ type: 'condition', column: 'role', op: '=', negate: false, value: 'owner' },
					]
				}
			}]
		});
		expect(result).toEqual([{ query: "SELECT id FROM users WHERE (role = $1 OR role = $2);", parameters: ['admin', 'owner'] }]);
	});

	test('nested groups with mixed connectors', () => {
		const result = schemaToSqlQuery({
			queries: [{
				select: ['id'],
				from: 'users',
				where: {
					type: 'group', connector: 'AND', negate: false,
					children: [
						{ type: 'condition', column: 'active', op: '=', negate: false, value: true },
						{
							type: 'group', connector: 'OR', negate: false,
							children: [
								{ type: 'condition', column: 'role', op: '=', negate: false, value: 'admin' },
								{ type: 'condition', column: 'role', op: '=', negate: false, value: 'owner' },
							]
						}
					]
				}
			}]
		});
		expect(result).toEqual([{ query: "SELECT id FROM users WHERE (active = $1 AND (role = $2 OR role = $3));", parameters: [true, 'admin', 'owner'] }]);
	});

	test('NOT on a condition', () => {
		const result = schemaToSqlQuery({
			queries: [{
				select: ['id'],
				from: 'users',
				where: {
					type: 'group', connector: 'AND', negate: false,
					children: [{ type: 'condition', column: 'deleted', op: '=', negate: true, value: true }]
				}
			}]
		});
		expect(result).toEqual([{ query: 'SELECT id FROM users WHERE NOT (deleted = $1);', parameters: [true] }]);
	});

	test('IN operator', () => {
		const result = schemaToSqlQuery({
			queries: [{
				select: ['id'],
				from: 'users',
				where: {
					type: 'group', connector: 'AND', negate: false,
					children: [{ type: 'condition', column: 'status', op: 'IN', negate: false, value: ['active', 'pending'] }]
				}
			}]
		});
		expect(result).toEqual([{ query: "SELECT id FROM users WHERE status IN ($1, $2);", parameters: ['active', 'pending'] }]);
	});

	test('BETWEEN operator', () => {
		const result = schemaToSqlQuery({
			queries: [{
				select: ['id'],
				from: 'users',
				where: {
					type: 'group', connector: 'AND', negate: false,
					children: [{ type: 'condition', column: 'age', op: 'BETWEEN', negate: false, value: 18, value2: 65 }]
				}
			}]
		});
		expect(result).toEqual([{ query: 'SELECT id FROM users WHERE age BETWEEN $1 AND $2;', parameters: [18, 65] }]);
	});
});
