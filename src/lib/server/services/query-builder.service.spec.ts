import { describe, expect, it, test } from 'vitest';
import { schemaToSqlQuery } from './query-builder.service';

describe('schemaToSqlQuery', () => {
	test('basic select, no where', () => {
		const result = schemaToSqlQuery({
			queries: [{ select: ['id', 'name'], from: 'public.users' }]
		});
		expect(result).toEqual([{ query: 'SELECT id, name FROM public.users;', parameters: [] }]);
	});

	test('single AND condition', () => {
		const result = schemaToSqlQuery({
			queries: [
				{
					select: ['id', 'name'],
					from: 'public.users',
					where: {
						type: 'group',
						connector: 'AND',
						negate: false,
						children: [{ type: 'condition', column: 'id', op: '=', negate: false, value: 1 }]
					}
				}
			]
		});
		expect(result).toEqual([
			{ query: 'SELECT id, name FROM public.users WHERE id = $1;', parameters: [1] }
		]);
	});

	test('multiple AND conditions', () => {
		const result = schemaToSqlQuery({
			queries: [
				{
					select: ['id', 'name'],
					from: 'public.users',
					where: {
						type: 'group',
						connector: 'AND',
						negate: false,
						children: [
							{ type: 'condition', column: 'id', op: '=', negate: false, value: 1 },
							{ type: 'condition', column: 'name', op: '=', negate: false, value: 'John Pork' }
						]
					}
				}
			]
		});
		expect(result).toEqual([
			{
				query: 'SELECT id, name FROM public.users WHERE (id = $1 AND name = $2);',
				parameters: [1, 'John Pork']
			}
		]);
	});

	test('OR conditions', () => {
		const result = schemaToSqlQuery({
			queries: [
				{
					select: ['id'],
					from: 'public.users',
					where: {
						type: 'group',
						connector: 'OR',
						negate: false,
						children: [
							{ type: 'condition', column: 'role', op: '=', negate: false, value: 'admin' },
							{ type: 'condition', column: 'role', op: '=', negate: false, value: 'owner' }
						]
					}
				}
			]
		});
		expect(result).toEqual([
			{
				query: 'SELECT id FROM public.users WHERE (role = $1 OR role = $2);',
				parameters: ['admin', 'owner']
			}
		]);
	});

	test('nested groups with mixed connectors', () => {
		const result = schemaToSqlQuery({
			queries: [
				{
					select: ['id'],
					from: 'public.users',
					where: {
						type: 'group',
						connector: 'AND',
						negate: false,
						children: [
							{ type: 'condition', column: 'active', op: '=', negate: false, value: true },
							{
								type: 'group',
								connector: 'OR',
								negate: false,
								children: [
									{ type: 'condition', column: 'role', op: '=', negate: false, value: 'admin' },
									{ type: 'condition', column: 'role', op: '=', negate: false, value: 'owner' }
								]
							}
						]
					}
				}
			]
		});
		expect(result).toEqual([
			{
				query: 'SELECT id FROM public.users WHERE (active = $1 AND (role = $2 OR role = $3));',
				parameters: [true, 'admin', 'owner']
			}
		]);
	});

	test('NOT on a condition', () => {
		const result = schemaToSqlQuery({
			queries: [
				{
					select: ['id'],
					from: 'public.users',
					where: {
						type: 'group',
						connector: 'AND',
						negate: false,
						children: [{ type: 'condition', column: 'deleted', op: '=', negate: true, value: true }]
					}
				}
			]
		});
		expect(result).toEqual([
			{ query: 'SELECT id FROM public.users WHERE NOT (deleted = $1);', parameters: [true] }
		]);
	});

	test('IN operator', () => {
		const result = schemaToSqlQuery({
			queries: [
				{
					select: ['id'],
					from: 'public.users',
					where: {
						type: 'group',
						connector: 'AND',
						negate: false,
						children: [
							{
								type: 'condition',
								column: 'status',
								op: 'IN',
								negate: false,
								value: ['active', 'pending']
							}
						]
					}
				}
			]
		});
		expect(result).toEqual([
			{
				query: 'SELECT id FROM public.users WHERE status IN ($1, $2);',
				parameters: ['active', 'pending']
			}
		]);
	});

	test('BETWEEN operator', () => {
		const result = schemaToSqlQuery({
			queries: [
				{
					select: ['id'],
					from: 'public.users',
					where: {
						type: 'group',
						connector: 'AND',
						negate: false,
						children: [
							{
								type: 'condition',
								column: 'age',
								op: 'BETWEEN',
								negate: false,
								value: 18,
								value2: 65
							}
						]
					}
				}
			]
		});
		expect(result).toEqual([
			{ query: 'SELECT id FROM public.users WHERE age BETWEEN $1 AND $2;', parameters: [18, 65] }
		]);
	});
});

describe('what the builder refuses', () => {
	const base = { select: ['id'], from: 'public.users' };
	const refused = (query: object) => () =>
		schemaToSqlQuery({ queries: [{ ...base, ...query }] } as never);

	it('anything but a plain table name in from or a join', () => {
		expect(refused({ from: 'auth.account' })).toThrow();
		expect(refused({ from: 'public.users; DROP TABLE public.users' })).toThrow();
		expect(refused({ from: '(SELECT * FROM auth.account) x' })).toThrow();
		expect(
			refused({
				joins: [
					{
						type: 'INNER',
						table: 'auth.account',
						on: { leftColumn: 'id', op: '=', rightColumn: 'user_id' }
					}
				]
			})
		).toThrow();
	});

	it('anything but a column name in select and conditions', () => {
		expect(refused({ select: ['(SELECT password FROM auth.account LIMIT 1)'] })).toThrow();
		expect(refused({ select: ['id, password'] })).toThrow();
		expect(
			refused({
				where: {
					type: 'group',
					connector: 'AND',
					negate: false,
					children: [{ type: 'condition', column: '1=1 OR id', op: '=', negate: false, value: 1 }]
				}
			})
		).toThrow();
	});

	it('an operator outside the list', () => {
		expect(
			refused({
				where: {
					type: 'group',
					connector: 'AND',
					negate: false,
					children: [{ type: 'condition', column: 'id', op: '= 1 OR 1 =', negate: false, value: 1 }]
				}
			})
		).toThrow();
	});

	it('still accepts qualified columns and star', () => {
		expect(refused({ select: ['*', 'users.id', 'public.users.name', 'users.*'] })).not.toThrow();
	});
});
