#!/usr/bin/env tsx
/**
 * First-time setup of a migrated database: saves the settings the app needs to
 * start and creates the first admin. Run `npm run setup -- --help` for usage.
 *
 * It follows https://clig.dev: results go to stdout and progress and errors to
 * stderr, it asks questions only in a terminal, every question has a flag, the
 * password is never a flag or an environment variable, color follows NO_COLOR
 * and the terminal, and exit codes are 0 (done), 1 (failed) and 2 (bad usage).
 */
import dotenv from 'dotenv';
import pg from 'pg';
import meow from 'meow';
import chalk, { chalkStderr as ui } from 'chalk';
import { createInterface } from 'node:readline';
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod';

dotenv.config({ quiet: true });

const cli = meow({
	importMeta: import.meta,
	description: 'Save the app settings and create the first admin on a migrated database.',
	help: `
	Usage
	  $ npm run setup -- [options]

	Options
	  --base-url <url>            Public address of the app, e.g. https://turf.example.org
	  --app-name <name>           Application name (default: TurfBuilder)
	  --admin-name <name>         First admin's name
	  --admin-username <name>     First admin's username
	  --admin-email <email>       First admin's email
	  --password-stdin            Read the admin's password from standard input
	  --mail-transport <kind>     direct or ses (left as it is when not given)
	  --mail-domain <domain>      Domain outgoing mail is sent from
	  --ses-region <region>       AWS region for SES
	  --no-input                  Never ask questions; fail if a value is missing
	  --debug                     Show the full error when something fails
	  -h, --help                  Show this help
	  --version                   Show the version

	Anything not given as a flag is asked for when run in a terminal.

	Run the migrations first (npm run migrate). The database comes from
	DATABASE_URL, in the environment or in .env.

	Examples
	  Ask for everything:
	    $ npm run setup

	  Without a terminal, such as in a script:
	    $ echo "$ADMIN_PASSWORD" | npm run setup -- --no-input --password-stdin \\
	        --base-url https://turf.example.org --admin-name "Ada Lovelace" \\
	        --admin-username ada --admin-email ada@example.org
`,
	allowUnknownFlags: false,
	flags: {
		help: { type: 'boolean', shortFlag: 'h' },
		baseUrl: { type: 'string' },
		appName: { type: 'string' },
		adminName: { type: 'string' },
		adminUsername: { type: 'string' },
		adminEmail: { type: 'string' },
		passwordStdin: { type: 'boolean', default: false },
		mailTransport: { type: 'string' },
		mailDomain: { type: 'string' },
		sesRegion: { type: 'string' },
		input: { type: 'boolean', default: true },
		debug: { type: 'boolean', default: false }
	}
});
const flags = cli.flags;

/** An expected failure: the message says what happened and the hint what to do. */
class SetupError extends Error {
	constructor(
		message: string,
		public readonly hint?: string,
		public readonly exitCode = 1
	) {
		super(message);
	}
}

const fields = {
	baseUrl: z
		.string()
		.trim()
		.refine((v) => {
			try {
				return ['http:', 'https:'].includes(new URL(v).protocol);
			} catch {
				return false;
			}
		}, 'Use a full address such as https://turf.example.org')
		.transform((v) => v.replace(/\/+$/, '')),
	appName: z.string().trim().min(1, 'App name cannot be blank'),
	mailTransport: z.enum(['direct', 'ses'], { message: 'Use direct or ses' }),
	name: z.string().trim().min(1, 'Name cannot be blank'),
	username: z
		.string()
		.trim()
		.regex(/^[a-zA-Z0-9_.]{3,30}$/, 'Use 3 to 30 letters, numbers, dots or underscores'),
	email: z.string().trim().email('Enter a valid email address'),
	password: z.string().min(8, 'Use at least 8 characters').max(128, 'Use at most 128 characters')
};

/** Checks a value given as a flag, so a typo fails before anything is touched. */
function fromFlag<T extends z.ZodType<string>>(flag: string, value: string | undefined, schema: T): z.infer<T> | undefined {
	if (value === undefined) return undefined;
	const checked = schema.safeParse(value);
	if (!checked.success) {
		throw new SetupError(`--${flag}: ${checked.error.issues[0].message}`, 'Run with --help to see the options.', 2);
	}
	return checked.data;
}

const interactive = Boolean(process.stdin.isTTY && process.stderr.isTTY) && flags.input && !flags.passwordStdin;

function cancel(): never {
	console.error(`\n${ui.yellow('Cancelled.')} Nothing was changed.`);
	process.exit(130);
}

/** Reads one line from the terminal, showing what is typed. */
function readLine(prompt: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
		let answered = false;
		rl.on('SIGINT', cancel);
		rl.on('close', () => {
			if (!answered) reject(new SetupError('Input ended before setup was complete.', 'Pass the missing values as flags. See --help.', 2));
		});
		rl.question(prompt, (answer) => {
			answered = true;
			rl.close();
			resolve(answer);
		});
	});
}

/** Reads a password, showing a dot for each character so it is clear that typing registers. */
function readPassword(prompt: string): Promise<string> {
	return new Promise((resolve) => {
		const stdin = process.stdin;
		const value: string[] = [];
		process.stderr.write(prompt);
		stdin.setRawMode(true);
		stdin.setEncoding('utf8');
		stdin.resume();

		const done = () => {
			stdin.off('data', onData);
			stdin.setRawMode(false);
			stdin.pause();
			process.stderr.write('\n');
		};
		const onData = (chunk: string) => {
			if (chunk.startsWith('\x1b')) return; // arrow keys and other escape sequences
			for (const ch of chunk) {
				if (ch === '\r' || ch === '\n') {
					done();
					return resolve(value.join(''));
				}
				if (ch === '\x03' || (ch === '\x04' && value.length === 0)) {
					stdin.setRawMode(false);
					cancel();
				}
				if (ch === '\x7f' || ch === '\b') {
					if (value.pop() !== undefined) process.stderr.write('\b \b');
				} else if (ch >= ' ') {
					value.push(ch);
					process.stderr.write('•');
				}
			}
		};
		stdin.on('data', onData);
	});
}

/** One line per field, always "Label (what to enter) [default]: ", asked again until the answer is valid. */
let announced = false;
async function ask<T extends z.ZodType<string>>(
	label: string,
	schema: T,
	opts: { hint?: string; fallback?: string; hidden?: boolean } = {}
): Promise<z.infer<T>> {
	if (!announced) {
		announced = true;
		console.error(ui.dim('Type an answer for each line and press Enter. Press Ctrl-C to cancel.\n'));
	}
	for (;;) {
		const hint = opts.hint ? ui.dim(` (${opts.hint})`) : '';
		const fallback = opts.fallback ? ui.dim(` [${opts.fallback}]`) : '';
		const prompt = `${ui.bold(label)}${hint}${fallback}: `;
		const answer = opts.hidden ? await readPassword(prompt) : await readLine(prompt);
		const checked = schema.safeParse(answer === '' && opts.fallback !== undefined ? opts.fallback : answer);
		if (checked.success) return checked.data;
		console.error(ui.yellow(`  ${checked.error.issues[0].message}`));
	}
}

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

const step = (text: string) => console.error(`${ui.green('✓')} ${text}`);

async function main() {
	// Check what was typed before anything else, so a typo costs nothing.
	const given = {
		baseUrl: fromFlag('base-url', flags.baseUrl, fields.baseUrl),
		appName: fromFlag('app-name', flags.appName, fields.appName),
		adminName: fromFlag('admin-name', flags.adminName, fields.name),
		adminUsername: fromFlag('admin-username', flags.adminUsername, fields.username),
		adminEmail: fromFlag('admin-email', flags.adminEmail, fields.email),
		mailTransport: fromFlag('mail-transport', flags.mailTransport, fields.mailTransport)
	};
	let stdinPassword: string | undefined;
	if (flags.passwordStdin) {
		const checked = fields.password.safeParse(await readStdin());
		if (!checked.success) {
			throw new SetupError(`Password from standard input: ${checked.error.issues[0].message}`, 'Run with --help to see the options.', 2);
		}
		stdinPassword = checked.data;
	}

	if (!process.env.DATABASE_URL) {
		throw new SetupError('DATABASE_URL is not set.', 'Add it to .env or the environment, then run this again.');
	}
	const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

	try {
		const notMigrated = new SetupError('The database is not migrated yet.', 'Run npm run migrate, then run this again.');
		const schema = await pool.query<{ ok: boolean }>(
			`SELECT to_regclass('public.system_setting') IS NOT NULL
			    AND to_regclass('auth.user') IS NOT NULL
			    AND to_regclass('public.registered_permission') IS NOT NULL AS ok`
		);
		if (!schema.rows[0].ok) throw notMigrated;
		const perms = await pool.query<{ n: number }>(
			`SELECT COUNT(*)::int AS n FROM registered_permission WHERE scope = 'infrastructure'`
		);
		if (perms.rows[0].n === 0) throw notMigrated;
		step('Database is migrated');

		const existing = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM auth."user"`);
		const adminNeeded = existing.rows[0].n === 0;

		// Collect everything still missing. Without a terminal, that is one error that names every gap.
		const missing: string[] = [];
		const need = async <T extends z.ZodType<string>>(
			flag: string,
			label: string,
			hint: string,
			value: z.infer<T> | undefined,
			schema: T,
			fallback?: string
		): Promise<z.infer<T>> => {
			if (value !== undefined) {
				if (interactive) console.error(`${ui.bold(label)}: ${value}`);
				return value;
			}
			if (interactive) return ask(label, schema, { hint, fallback });
			if (fallback !== undefined) return schema.parse(fallback);
			missing.push(`--${flag}`);
			return '' as z.infer<T>;
		};

		// A rerun keeps what is already saved unless told otherwise.
		const saved = await pool.query<{ key: string; value: string }>(
			`SELECT key, value FROM system_setting WHERE key IN ('base_url', 'application_name')`
		);
		const current = Object.fromEntries(saved.rows.map((r) => [r.key, r.value]));
		const baseUrl = await need(
			'base-url',
			'TurfBuilder URL',
			'where people open the app, e.g. https://turf.example.org',
			given.baseUrl,
			fields.baseUrl,
			current.base_url
		);
		const appName = await need(
			'app-name',
			'App name',
			'shown in the app and page titles',
			given.appName,
			fields.appName,
			current.application_name || 'TurfBuilder'
		);

		let admin: { name: string; username: string; email: string; passwordHash: string } | null = null;
		if (adminNeeded) {
			const name = await need('admin-name', 'Admin name', 'full name', given.adminName, fields.name);
			const username = await need('admin-username', 'Admin username', '3 to 30 letters, numbers, dots or underscores', given.adminUsername, fields.username);
			const email = await need('admin-email', 'Admin email', 'used to sign in', given.adminEmail, fields.email);

			let password = '';
			if (stdinPassword !== undefined) {
				password = stdinPassword;
			} else if (interactive) {
				for (;;) {
					password = await ask('Admin password', fields.password, { hint: 'hidden, at least 8 characters', hidden: true });
					if (password === (await ask('Repeat password', z.string(), { hint: 'hidden', hidden: true }))) break;
					console.error(ui.yellow('  The passwords do not match.'));
				}
			} else {
				missing.push('--password-stdin');
			}
			if (missing.length === 0) admin = { name, username, email, passwordHash: await hashPassword(password) };
		} else if (given.adminName || given.adminUsername || given.adminEmail || flags.passwordStdin) {
			console.error(ui.yellow('A user already exists, so the admin options were ignored.'));
		}

		if (missing.length > 0) {
			throw new SetupError(
				`Missing ${missing.join(', ')}.`,
				flags.input
					? 'Pass them as flags, or run this in a terminal to be asked. See --help.'
					: 'Pass them as flags. See --help.',
				2
			);
		}

		const settings: [string, string][] = [
			['base_url', baseUrl],
			['application_name', appName]
		];
		if (given.mailTransport !== undefined) settings.push(['mail.transport', given.mailTransport]);
		if (flags.mailDomain !== undefined) settings.push(['mail.domain', flags.mailDomain.trim()]);
		if (flags.sesRegion !== undefined) settings.push(['mail.ses.region', flags.sesRegion.trim()]);

		const client = await pool.connect();
		try {
			await client.query('BEGIN');

			for (const [key, value] of settings) {
				await client.query(
					`INSERT INTO system_setting (key, value) VALUES ($1, $2)
					 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
					[key, value]
				);
			}

			if (admin) {
				const user = await client.query<{ id: string }>(
					`INSERT INTO auth."user" (name, username, display_username, email, email_verified)
					 VALUES ($1, $2, $3, $4, true)
					 RETURNING id`,
					[admin.name, admin.username.toLowerCase(), admin.username, admin.email.toLowerCase()]
				);
				const userId = user.rows[0].id;

				await client.query(
					`INSERT INTO auth.account (user_id, account_id, provider_id, password)
					 VALUES ($1::uuid, $1::text, 'credential', $2)`,
					[userId, admin.passwordHash]
				);

				await client.query(
					`INSERT INTO permission_role (name, weight, scope, organization_id, is_default)
					 VALUES ('Infrastructure Administrator', 0, 'infrastructure', NULL, false)
					 ON CONFLICT DO NOTHING`
				);
				const role = await client.query<{ id: string }>(
					`SELECT id FROM permission_role
					 WHERE scope = 'infrastructure' AND name = 'Infrastructure Administrator' LIMIT 1`
				);
				const roleId = role.rows[0].id;
				await client.query(
					`INSERT INTO permission_role_entry (role_id, registered_permission_id, value)
					 SELECT $1, id, true FROM registered_permission WHERE scope = 'infrastructure'
					 ON CONFLICT DO NOTHING`,
					[roleId]
				);
				await client.query(
					`INSERT INTO user_role_membership (user_id, member_id, role_id, granted_by)
					 VALUES ($1, NULL, $2, $1)
					 ON CONFLICT DO NOTHING`,
					[userId, roleId]
				);

				// The app records this when someone signs up, so the dashboards count the admin too.
				await client.query(
					`INSERT INTO activity_event (type, user_id, metadata, source_key)
					 VALUES ('user.signed_up', $1, '{}', $2)
					 ON CONFLICT (source_key) DO NOTHING`,
					[userId, `user.signed_up:${userId}`]
				);
			}

			await client.query('COMMIT');
		} catch (e) {
			await client.query('ROLLBACK');
			throw e;
		} finally {
			client.release();
		}

		step(`Saved ${settings.map(([key]) => key).join(', ')}`);
		if (admin) step(`Created the admin ${admin.email.toLowerCase()}, with a verified email`);

		// The result goes to stdout; everything above was progress.
		console.log(chalk.bold('Setup complete.'));
		console.log(`Start or restart the app, then sign in at ${baseUrl}/auth/signin`);
	} finally {
		await pool.end();
	}
}

main()
	.catch((e) => {
		if (e instanceof SetupError) {
			console.error(`${ui.red('error:')} ${e.message}`);
			if (e.hint) console.error(e.hint);
			process.exitCode = e.exitCode;
		} else {
			console.error(`${ui.red('error:')} ${e instanceof Error ? e.message : String(e)}`);
			if (flags.debug && e instanceof Error && e.stack) console.error(ui.dim(e.stack));
			else console.error('Nothing was changed. Run with --debug for the full error.');
			process.exitCode = 1;
		}
	})
	.finally(() => process.stdin.pause());
