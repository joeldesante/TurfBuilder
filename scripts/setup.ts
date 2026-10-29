#!/usr/bin/env tsx
/**
 * First-time setup of a migrated database: saves the settings the app needs to
 * start, and creates the first admin.
 *
 * It does not touch the schema. Run the migrations first:
 *   npm run migrate
 *
 * Usage:
 *   npm run setup                     # asks for everything
 *   npm run setup -- --base-url https://turf.example.org --app-name TurfBuilder \
 *     --admin-name "Ada Lovelace" --admin-username ada --admin-email ada@example.org
 *   SETUP_ADMIN_PASSWORD=... npm run setup -- ...   # the password is never a flag
 *
 * Flags: --base-url --app-name --mail-transport (direct|ses) --mail-domain
 * --ses-region --admin-name --admin-username --admin-email. Anything not given
 * is asked for. Rerunning is safe: settings are overwritten, and no second
 * admin is created once a user exists.
 *
 * The first admin is created with a verified email and holds every
 * infrastructure permission.
 *
 * Env:
 *   DATABASE_URL          required
 *   SETUP_ADMIN_PASSWORD  the admin's password, instead of being asked
 */
import dotenv from 'dotenv';
import pg from 'pg';
import { parseArgs } from 'node:util';
import { Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod';

dotenv.config({ quiet: true });

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
		}, 'Enter a full address such as https://turf.example.org'),
	appName: z.string().trim().min(1, 'Enter a name'),
	mailTransport: z.enum(['direct', 'ses'], { message: 'Enter direct or ses' }),
	mailDomain: z.string().trim(),
	sesRegion: z.string().trim(),
	name: z.string().trim().min(1, 'Enter a name'),
	username: z
		.string()
		.trim()
		.regex(/^[a-zA-Z0-9_.]{3,30}$/, '3 to 30 letters, numbers, dots or underscores'),
	email: z.string().trim().email('Enter a valid email address'),
	password: z.string().min(8, 'At least 8 characters').max(128, 'At most 128 characters')
};

const { values: flags } = parseArgs({
	options: {
		'base-url': { type: 'string' },
		'app-name': { type: 'string' },
		'mail-transport': { type: 'string' },
		'mail-domain': { type: 'string' },
		'ses-region': { type: 'string' },
		'admin-name': { type: 'string' },
		'admin-username': { type: 'string' },
		'admin-email': { type: 'string' }
	}
});

let muted = false;
const output = new Writable({
	write(chunk, encoding, done) {
		if (!muted) process.stdout.write(chunk, encoding);
		done();
	}
});
const rl = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
// With no terminal and no input left, fail instead of waiting for an answer that never comes.
const inputEnded = new Promise<never>((_, reject) =>
	rl.once('close', () => reject(new Error('Input ended before setup was complete. Pass the missing values as flags.')))
);
inputEnded.catch(() => {});

/** Asks until the answer passes the check. A blank answer takes the fallback when there is one. */
async function ask<T extends z.ZodType<string>>(
	label: string,
	schema: T,
	opts: { fallback?: string; hidden?: boolean; given?: string } = {}
): Promise<z.infer<T>> {
	if (opts.given !== undefined) {
		const checked = schema.safeParse(opts.given);
		if (!checked.success) throw new Error(`${label}: ${checked.error.issues[0].message}`);
		return checked.data;
	}
	for (;;) {
		process.stdout.write(opts.fallback ? `${label} [${opts.fallback}]: ` : `${label}: `);
		muted = Boolean(opts.hidden);
		let answer: string;
		try {
			answer = await Promise.race([rl.question(''), inputEnded]);
		} catch {
			throw new Error('Input ended before setup was complete. Pass the missing values as flags.');
		}
		muted = false;
		if (opts.hidden) process.stdout.write('\n');
		if (answer === '' && opts.fallback !== undefined) answer = opts.fallback;
		const checked = schema.safeParse(answer);
		if (checked.success) return checked.data;
		console.log(`  ${checked.error.issues[0].message}`);
	}
}

async function main() {
	if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set. Add it to .env or the environment.');
	const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

	try {
		const notMigrated = 'The database is not migrated yet. Run npm run migrate first, then run setup again.';
		const schema = await pool.query<{ ok: boolean }>(
			`SELECT to_regclass('public.system_setting') IS NOT NULL
			    AND to_regclass('auth.user') IS NOT NULL
			    AND to_regclass('public.registered_permission') IS NOT NULL AS ok`
		);
		if (!schema.rows[0].ok) throw new Error(notMigrated);
		const perms = await pool.query<{ n: number }>(
			`SELECT COUNT(*)::int AS n FROM registered_permission WHERE scope = 'infrastructure'`
		);
		if (perms.rows[0].n === 0) throw new Error(notMigrated);

		const existing = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM auth."user"`);
		const adminExists = existing.rows[0].n > 0;

		console.log('\nApp settings');
		const baseUrl = await ask('Public address of the app', fields.baseUrl, { given: flags['base-url'] });
		const appName = await ask('Application name', fields.appName, {
			given: flags['app-name'],
			fallback: 'TurfBuilder'
		});
		const mailTransport = await ask('Mail transport (direct or ses)', fields.mailTransport, {
			given: flags['mail-transport'],
			fallback: 'direct'
		});
		const mailDomain = await ask('Mail domain, blank to skip', fields.mailDomain, {
			given: flags['mail-domain'],
			fallback: ''
		});
		const sesRegion =
			mailTransport === 'ses'
				? await ask('SES region, e.g. us-east-1', fields.sesRegion, { given: flags['ses-region'], fallback: '' })
				: '';

		let admin: { name: string; username: string; email: string; passwordHash: string } | null = null;
		if (adminExists) {
			console.log('\nA user already exists, so no admin will be created.');
		} else {
			console.log('\nFirst admin');
			const name = await ask('Name', fields.name, { given: flags['admin-name'] });
			const username = await ask('Username', fields.username, { given: flags['admin-username'] });
			const email = await ask('Email', fields.email, { given: flags['admin-email'] });
			let password = process.env.SETUP_ADMIN_PASSWORD;
			if (password !== undefined) {
				password = await ask('SETUP_ADMIN_PASSWORD', fields.password, { given: password });
			} else {
				for (;;) {
					password = await ask('Password', fields.password, { hidden: true });
					if (password === (await ask('Repeat the password', z.string(), { hidden: true }))) break;
					console.log('  The passwords do not match.');
				}
			}
			admin = { name, username, email, passwordHash: await hashPassword(password) };
		}

		const client = await pool.connect();
		try {
			await client.query('BEGIN');

			const settings: [string, string][] = [
				['base_url', baseUrl],
				['application_name', appName],
				['mail.transport', mailTransport],
				['mail.domain', mailDomain],
				['mail.ses.region', sesRegion]
			];
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

		console.log('\nSetup complete.');
		console.log('  Settings saved.');
		if (admin) console.log(`  Admin ${admin.email.toLowerCase()} created, with a verified email.`);
		console.log(`\nStart or restart the app, then sign in at ${baseUrl.replace(/\/+$/, '')}/auth/signin`);
	} finally {
		await pool.end();
	}
}

main()
	.catch((e) => {
		console.error(`\n${e instanceof Error ? e.message : String(e)}`);
		process.exitCode = 1;
	})
	.finally(() => rl.close());
