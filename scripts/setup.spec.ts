import { describe, it, expect } from 'vitest';
import Joker from '@amilajack/joker';

/**
 * Runs `npm run setup` as a real process and checks what it prints and how it
 * exits. Joker talks to it through pipes, so the script takes its non-terminal
 * path: every value comes from a flag or standard input.
 *
 * DATABASE_URL is emptied in every run, so nothing here can reach a database.
 * A value that passes validation gets as far as "DATABASE_URL is not set".
 */

const BASE = {
	'base-url': 'https://turf.example.org',
	'admin-name': 'Ada Lovelace',
	'admin-username': 'ada',
	'admin-email': 'ada@example.org'
};

const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

interface Outcome {
	code: number;
	stdout: string;
	stderr: string;
}

async function setup(flags: Record<string, string>, opts: { stdin?: string; extra?: string[] } = {}): Promise<Outcome> {
	const args = Object.entries(flags).flatMap(([flag, value]) => [`--${flag}`, quote(value)]);
	if (opts.stdin !== undefined) args.push('--password-stdin');
	args.push(...(opts.extra ?? []));

	let outcome!: Outcome;
	let runner = new Joker()
		.env('DATABASE_URL', '')
		.env('NO_COLOR', '1')
		.env('FORCE_COLOR', '0')
		.timeout(20_000)
		.run(`node_modules/.bin/tsx scripts/setup.ts ${args.join(' ')}`);
	if (opts.stdin !== undefined) runner = runner.stdin(opts.stdin);
	await runner
		.expect((res) => {
			outcome = { code: res.code, stdout: res.stdout, stderr: res.stderr };
		})
		.end();
	return outcome;
}

const GOOD_PASSWORD = 'Password123';
const NOT_IN_DATABASE = 'DATABASE_URL is not set';

describe.concurrent('npm run setup flag validation', { timeout: 30_000 }, () => {
	it('accepts a complete, valid set of values and goes on to the database', async () => {
		const out = await setup(BASE, { stdin: GOOD_PASSWORD });

		expect(out.stderr).toContain(NOT_IN_DATABASE);
		expect(out.code).toBe(1);
	});

	it('prints help and exits 0', async () => {
		const out = await setup({}, { extra: ['--help'] });

		expect(out.code).toBe(0);
		expect(out.stdout).toContain('Usage');
		expect(out.stdout).toContain('--admin-email');
	});

	it('rejects an unknown flag with exit code 2', async () => {
		const out = await setup({ ...BASE, nope: 'x' }, { stdin: GOOD_PASSWORD });

		expect(out.code).toBe(2);
		expect(out.stderr + out.stdout).toContain('nope');
	});

	describe.concurrent('TurfBuilder URL', () => {
		it.each([
			['blank', ''],
			['not an address', 'nope'],
			['no scheme', 'turf.example.org'],
			['not http or https', 'ftp://turf.example.org']
		])('rejects %s', async (_name, value) => {
			const out = await setup({ ...BASE, 'base-url': value }, { stdin: GOOD_PASSWORD });

			expect(out.code).toBe(2);
			expect(out.stderr).toContain('--base-url: Use a full address');
		});

		it.each(['https://turf.example.org', 'https://turf.example.org/', 'http://localhost:5173'])('accepts %s', async (value) => {
			const out = await setup({ ...BASE, 'base-url': value }, { stdin: GOOD_PASSWORD });

			expect(out.stderr).toContain(NOT_IN_DATABASE);
		});
	});

	describe.concurrent('app name', () => {
		it.each([
			['blank', ''],
			['only spaces', '   ']
		])('rejects %s', async (_name, value) => {
			const out = await setup({ ...BASE, 'app-name': value }, { stdin: GOOD_PASSWORD });

			expect(out.code).toBe(2);
			expect(out.stderr).toContain('--app-name: App name cannot be blank');
		});
	});

	describe.concurrent('admin name', () => {
		it.each([
			['blank', ''],
			['only spaces', '   ']
		])('rejects %s', async (_name, value) => {
			const out = await setup({ ...BASE, 'admin-name': value }, { stdin: GOOD_PASSWORD });

			expect(out.code).toBe(2);
			expect(out.stderr).toContain('--admin-name: Name cannot be blank');
		});
	});

	describe.concurrent('admin username', () => {
		it.each([
			['blank', ''],
			['too short', 'ab'],
			['too long', 'a'.repeat(31)],
			['has a space', 'ada l'],
			['has a symbol', 'ada!'],
			['has a dash', 'ada-l']
		])('rejects %s', async (_name, value) => {
			const out = await setup({ ...BASE, 'admin-username': value }, { stdin: GOOD_PASSWORD });

			expect(out.code).toBe(2);
			expect(out.stderr).toContain('--admin-username: Use 3 to 30 letters, numbers, dots or underscores');
		});

		it.each(['abc', 'Ada.L_1', 'a'.repeat(30)])('accepts %s', async (value) => {
			const out = await setup({ ...BASE, 'admin-username': value }, { stdin: GOOD_PASSWORD });

			expect(out.stderr).toContain(NOT_IN_DATABASE);
		});
	});

	describe.concurrent('admin email', () => {
		it.each([
			['blank', ''],
			['no @', 'ada.example.org'],
			['no domain', 'ada@'],
			['has a space', 'ada lovelace@example.org']
		])('rejects %s', async (_name, value) => {
			const out = await setup({ ...BASE, 'admin-email': value }, { stdin: GOOD_PASSWORD });

			expect(out.code).toBe(2);
			expect(out.stderr).toContain('--admin-email: Enter a valid email address');
		});
	});

	describe.concurrent('admin password from standard input', () => {
		it.each([
			['blank', '', 'Use at least 8 characters'],
			['too short', 'short', 'Use at least 8 characters'],
			['too long', 'x'.repeat(129), 'Use at most 128 characters']
		])('rejects %s', async (_name, value, message) => {
			const out = await setup(BASE, { stdin: value });

			expect(out.code).toBe(2);
			expect(out.stderr).toContain(`Password from standard input: ${message}`);
		});

		it('accepts the shortest and the longest allowed', async () => {
			const shortest = await setup(BASE, { stdin: 'x'.repeat(8) });
			const longest = await setup(BASE, { stdin: 'x'.repeat(128) });

			expect(shortest.stderr).toContain(NOT_IN_DATABASE);
			expect(longest.stderr).toContain(NOT_IN_DATABASE);
		});
	});

	describe.concurrent('mail transport', () => {
		it('rejects a value that is not direct or ses', async () => {
			const out = await setup({ ...BASE, 'mail-transport': 'smtp' }, { stdin: GOOD_PASSWORD });

			expect(out.code).toBe(2);
			expect(out.stderr).toContain('--mail-transport: Use direct or ses');
		});

		it.each(['direct', 'ses'])('accepts %s', async (value) => {
			const out = await setup({ ...BASE, 'mail-transport': value }, { stdin: GOOD_PASSWORD });

			expect(out.stderr).toContain(NOT_IN_DATABASE);
		});
	});
});
