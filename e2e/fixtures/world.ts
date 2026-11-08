import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { stubMapTiles } from './map';

/**
 * Factories for the people and records e2e tests act on. Everything a world
 * makes has a random suffix, so specs can run in parallel against one
 * database without seeing each other's rows.
 *
 * Users and organizations are made through the app (better-auth sign-up, the
 * organizations endpoint) so they get exactly what real ones get: password
 * hashes, default roles, activity events. Memberships and the records tests
 * read are seeded in the database or through the app's own endpoints; the
 * endpoint paths live here, so moving an endpoint means changing one file.
 */

export interface TestUser {
	id: string;
	email: string;
	username: string;
	name: string;
	password: string;
}

export interface TestOrg {
	id: string;
	slug: string;
	name: string;
	owner: TestUser;
	/** Ids of the four roles every org starts with. */
	roles: { Administrator: string; Organizer: string; Analyst: string; Everyone: string };
}

export interface Session {
	user: TestUser | null;
	context: BrowserContext;
	page: Page;
	/** Requests with the session's cookies and an Origin better-auth accepts. */
	request: APIRequestContext;
}

/** The kinds of people the coverage sheet tests features as. */
export type Persona = 'owner' | 'admin' | 'organizer' | 'analyst' | 'volunteer' | 'outsider';

export const ADMIN = { email: 'test@example.com', password: 'Password123' };

const PASSWORD = 'Password123!e2e';

export function suffix(): string {
	return randomUUID().slice(0, 8);
}

export class World {
	private contexts: BrowserContext[] = [];

	constructor(
		readonly db: Client,
		private browser: Browser,
		readonly baseURL: string
	) {}

	async dispose(): Promise<void> {
		await Promise.all(this.contexts.map((c) => c.close().catch(() => {})));
	}

	// -----------------------------------------------------------------------
	// Sessions
	// -----------------------------------------------------------------------

	/** A fresh browser context, signed out. */
	async anonymous(): Promise<Session> {
		const context = await this.browser.newContext({
			baseURL: this.baseURL,
			extraHTTPHeaders: { origin: this.baseURL }
		});
		await stubMapTiles(context);
		this.contexts.push(context);
		return { user: null, context, page: await context.newPage(), request: context.request };
	}

	/** A browser context signed in as `user`, through better-auth's own sign-in. */
	async signIn(user: Pick<TestUser, 'email' | 'password'> & Partial<TestUser>): Promise<Session> {
		const session = await this.anonymous();
		const res = await session.request.post('/api/auth/sign-in/email', {
			data: { email: user.email, password: user.password }
		});
		if (!res.ok())
			throw new Error(`Sign-in failed for ${user.email}: ${res.status()} ${await res.text()}`);
		return { ...session, user: (user as TestUser) ?? null };
	}

	/** The infrastructure admin that `npm run setup` creates, with every infra permission. */
	async admin(): Promise<Session> {
		return this.signIn(ADMIN);
	}

	// -----------------------------------------------------------------------
	// Users, orgs, members
	// -----------------------------------------------------------------------

	/** Signs a user up through better-auth. Verified by default, since staff pages need it. */
	async createUser({
		verified = true,
		name
	}: { verified?: boolean; name?: string } = {}): Promise<TestUser> {
		const s = suffix();
		const user = {
			email: `e2e-${s}@example.test`,
			username: `e2e${s}`,
			name: name ?? `E2E User ${s}`,
			password: PASSWORD
		};
		const anon = await this.anonymous();
		const res = await anon.request.post('/api/auth/sign-up/email', { data: user });
		if (!res.ok()) throw new Error(`Sign-up failed: ${res.status()} ${await res.text()}`);
		await anon.context.close();

		const { rows } = await this.db.query<{ id: string }>(
			`UPDATE auth."user" SET email_verified = $2 WHERE email = $1 RETURNING id`,
			[user.email, verified]
		);
		return { id: rows[0].id, ...user };
	}

	/** Creates an org through the app, with `owner` (made when omitted) as its owner. */
	async createOrg({ owner, name }: { owner?: TestUser; name?: string } = {}): Promise<TestOrg> {
		const ownerUser = owner ?? (await this.createUser());
		const s = suffix();
		const org = { name: name ?? `E2E Org ${s}`, slug: `e2e-${s}` };

		const session = await this.signIn(ownerUser);
		const res = await session.request.post('/api/v1/organizations', { data: org });
		if (!res.ok()) throw new Error(`Org creation failed: ${res.status()} ${await res.text()}`);
		const { id } = (await res.json()) as { id: string };
		await session.context.close();

		const { rows } = await this.db.query<{ id: string; name: string }>(
			`SELECT id, name FROM permission_role WHERE organization_id = $1`,
			[id]
		);
		const roles = Object.fromEntries(rows.map((r) => [r.name, r.id])) as TestOrg['roles'];
		return { id, ...org, owner: ownerUser, roles };
	}

	/**
	 * Adds `user` to `org` as better-auth does for an invite: a plain member
	 * with the default role. `role` adds one of the starting roles; `permissions`
	 * instead adds a role made for this member that grants exactly those keys.
	 * Returns the membership id.
	 */
	async addMember(
		org: TestOrg,
		user: Pick<TestUser, 'id'>,
		{ role, permissions }: { role?: keyof TestOrg['roles']; permissions?: string[] } = {}
	): Promise<string> {
		const { rows } = await this.db.query<{ id: string }>(
			`INSERT INTO auth.member (user_id, organization_id, role) VALUES ($1, $2, 'member') RETURNING id`,
			[user.id, org.id]
		);
		const memberId = rows[0].id;

		await this.grantRole(user, memberId, org.roles.Everyone);
		if (role && role !== 'Everyone') await this.grantRole(user, memberId, org.roles[role]);
		if (permissions) {
			const roleId = await this.createRole(org, `E2E role ${suffix()}`, permissions);
			await this.grantRole(user, memberId, roleId);
		}
		return memberId;
	}

	/** A role in `org` granting exactly `permissions`. */
	async createRole(
		org: TestOrg,
		name: string,
		permissions: string[],
		weight = 300
	): Promise<string> {
		const { rows } = await this.db.query<{ id: string }>(
			`INSERT INTO permission_role (name, weight, scope, organization_id, is_default)
			 VALUES ($1, $2, 'organization', $3, false) RETURNING id`,
			[name, weight, org.id]
		);
		if (permissions.length > 0) {
			await this.db.query(
				`INSERT INTO permission_role_entry (role_id, registered_permission_id, value)
				 SELECT $1, id, true FROM registered_permission WHERE key = ANY($2::text[])`,
				[rows[0].id, permissions]
			);
		}
		return rows[0].id;
	}

	private async grantRole(
		user: Pick<TestUser, 'id'>,
		memberId: string,
		roleId: string
	): Promise<void> {
		await this.db.query(
			`INSERT INTO user_role_membership (user_id, member_id, role_id) VALUES ($1, $2, $3)
			 ON CONFLICT DO NOTHING`,
			[user.id, memberId, roleId]
		);
	}

	/**
	 * A signed-in member of `org` of the given kind. `owner` is the org's owner;
	 * `outsider` belongs to another org only; `volunteer` has just the default
	 * role (canvass.use).
	 */
	async as(
		org: TestOrg,
		persona: Persona
	): Promise<Session & { user: TestUser; memberId?: string }> {
		if (persona === 'owner') return { ...(await this.signIn(org.owner)), user: org.owner };

		const user = await this.createUser();
		let memberId: string | undefined;
		if (persona === 'outsider') {
			await this.createOrg({ owner: user });
		} else {
			const role = {
				admin: 'Administrator',
				organizer: 'Organizer',
				analyst: 'Analyst',
				volunteer: undefined
			}[persona] as keyof TestOrg['roles'] | undefined;
			memberId = await this.addMember(org, user, { role });
		}
		return { ...(await this.signIn(user)), user, memberId };
	}

	/** A signed-in staff member of `org` whose only staff permissions are `permissions` (plus system.access). */
	async staffWith(
		org: TestOrg,
		permissions: string[]
	): Promise<Session & { user: TestUser; memberId: string }> {
		const user = await this.createUser();
		const memberId = await this.addMember(org, user, {
			permissions: [...new Set(['system.access', ...permissions])]
		});
		return { ...(await this.signIn(user)), user, memberId };
	}

	// -----------------------------------------------------------------------
	// Records, through the app's own endpoints. The paths are here so that an
	// endpoint move (plan steps E to G) changes this file only.
	// -----------------------------------------------------------------------

	/** Imports locations from rows of CSV columns, as staff do from the manage page. Returns their entity ids, in order. */
	async importLocations(staff: Session, org: TestOrg, rows: LocationRow[]): Promise<string[]> {
		const before = await this.db.query<{ n: number }>(
			`SELECT count(*)::int AS n FROM universe.org_location WHERE org_id = $1 AND valid_to IS NULL`,
			[org.id]
		);
		const res = await staff.request.post(`/o/${org.slug}/s/api/universe/locations/import`, {
			multipart: {
				file: { name: 'locations.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(rows)) }
			}
		});
		if (!res.ok()) throw new Error(`Location import failed: ${res.status()} ${await res.text()}`);
		const { rows: ids } = await this.db.query<{ entity_id: string }>(
			`SELECT entity_id FROM universe.org_location WHERE org_id = $1 AND valid_to IS NULL
			 ORDER BY created_at, id OFFSET $2`,
			[org.id, before.rows[0].n]
		);
		return ids.map((r) => r.entity_id);
	}

	/** Imports people from rows of CSV columns. */
	async importPeople(staff: Session, org: TestOrg, rows: Record<string, string>[]): Promise<void> {
		const res = await staff.request.post(`/api/v1/organizations/${org.id}/people-imports`, {
			multipart: {
				file: { name: 'people.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(rows)) }
			}
		});
		if (!res.ok()) throw new Error(`People import failed: ${res.status()} ${await res.text()}`);
	}

	/** Creates a bucket. Each kind is a filter group, or null to leave that kind out. */
	async createBucket(
		staff: Session,
		org: TestOrg,
		{
			name = `Bucket ${suffix()}`,
			people = null,
			locations = ALL
		}: { name?: string; people?: FilterGroup | null; locations?: FilterGroup | null } = {}
	): Promise<{ id: string; slug: string; name: string }> {
		const slug = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
		const res = await staff.request.post(`/api/v1/organizations/${org.id}/buckets`, {
			data: { name, slug, filters: { v: 2, people, locations } }
		});
		if (!res.ok()) throw new Error(`Bucket creation failed: ${res.status()} ${await res.text()}`);
		return (await res.json()) as { id: string; slug: string; name: string };
	}

	/** How many records of a kind a bucket matches. */
	async bucketCount(
		staff: Session,
		bucketId: string,
		kind: 'locations' | 'people'
	): Promise<number> {
		const res = await staff.request.get(`/api/v1/buckets/${bucketId}/${kind}`);
		if (!res.ok()) throw new Error(`Bucket ${kind} failed: ${res.status()} ${await res.text()}`);
		return ((await res.json()) as { totalCount: number }).totalCount;
	}

	/** Snapshots a list of the bucket's locations (or people). */
	async createList(
		staff: Session,
		bucketId: string,
		{
			name = `List ${suffix()}`,
			kind = 'locations' as 'locations' | 'people',
			filters
		}: { name?: string; kind?: 'locations' | 'people'; filters?: FilterGroup } = {}
	): Promise<{ id: string; name: string }> {
		const res = await staff.request.post(`/api/v1/buckets/${bucketId}/lists`, {
			data: {
				name,
				entity_type: kind,
				expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
				filters
			}
		});
		if (!res.ok()) throw new Error(`List creation failed: ${res.status()} ${await res.text()}`);
		return (await res.json()) as { id: string; name: string };
	}

	/** A survey in a bucket with the given questions. */
	async createSurvey(
		staff: Session,
		bucketId: string,
		questions: {
			question_text: string;
			question_type: 'text' | 'radio' | 'check';
			choices?: string[];
		}[] = [{ question_text: 'Will you vote?', question_type: 'radio', choices: ['Yes', 'No'] }],
		name = `Survey ${suffix()}`
	): Promise<{ id: string; questions: { id: string; question_text: string }[] }> {
		const created = await staff.request.post(`/api/v1/buckets/${bucketId}/surveys`, {
			data: { name }
		});
		if (!created.ok())
			throw new Error(`Survey creation failed: ${created.status()} ${await created.text()}`);
		const { id } = (await created.json()) as { id: string };
		const res = await staff.request.put(`/api/v1/surveys/${id}/questions`, {
			data: questions.map((q) => ({ ...q, choices: q.choices ?? [] }))
		});
		if (!res.ok()) throw new Error(`Questions failed: ${res.status()} ${await res.text()}`);
		return { id, questions: (await res.json()) as { id: string; question_text: string }[] };
	}

	/**
	 * Cuts one turf from a list covering `polygon` (by default the whole world,
	 * so every location in the list), with the survey and optional script.
	 */
	async createTurf(
		staff: Session,
		org: TestOrg,
		{
			listId,
			surveyId,
			scriptId = null,
			polygon = WORLD
		}: { listId: string; surveyId: string; scriptId?: string | null; polygon?: object }
	): Promise<{ id: string; code: string }> {
		const res = await staff.request.post(`/o/${org.slug}/s/api/turf/create`, {
			data: {
				polygons: [{ geometry: polygon }],
				survey_id: surveyId,
				script_id: scriptId,
				list_id: listId
			}
		});
		if (!res.ok()) throw new Error(`Turf creation failed: ${res.status()} ${await res.text()}`);
		const { turfs } = (await res.json()) as { turfs: { id: string; code: string }[] };
		return turfs[0];
	}

	/** The turf_location ids of a turf's doors, in the order they were cut. */
	async turfDoors(turfId: string): Promise<{ id: string; name: string | null }[]> {
		const { rows } = await this.db.query<{ id: string; name: string | null }>(
			`SELECT tl.id, ol.name FROM universe.turf_location tl
			 JOIN universe.org_location ol ON ol.id = tl.org_location_id
			 WHERE tl.turf_id = $1 ORDER BY ol.name`,
			[turfId]
		);
		return rows;
	}

	/** A script in a bucket. */
	async createScript(
		staff: Session,
		bucketId: string,
		contents = 'Hi, I am a volunteer.'
	): Promise<{ id: string }> {
		const res = await staff.request.post(`/api/v1/buckets/${bucketId}/scripts`, {
			data: { name: `Script ${suffix()}`, contents }
		});
		if (!res.ok()) throw new Error(`Script creation failed: ${res.status()} ${await res.text()}`);
		return (await res.json()) as { id: string };
	}
}

export interface FilterGroup {
	operator: 'AND' | 'OR';
	filters: unknown[];
}

/** A polygon around the whole map. */
export const WORLD = {
	type: 'Polygon',
	coordinates: [
		[
			[-179, -85],
			[179, -85],
			[179, 85],
			[-179, 85],
			[-179, -85]
		]
	]
};

/** Matches everything of its kind. */
export const ALL: FilterGroup = { operator: 'AND', filters: [] };

export type LocationRow = Partial<
	Record<
		| 'name'
		| 'address_line_1'
		| 'city'
		| 'state_or_region'
		| 'postal_code'
		| 'country_code'
		| 'latitude'
		| 'longitude',
		string | number
	>
>;

/** Rows as CSV with a header of every column used. */
export function csv(rows: Record<string, unknown>[]): string {
	const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
	const cell = (v: unknown) => {
		const text = v === undefined || v === null ? '' : String(v);
		return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
	};
	return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join(
		'\n'
	);
}
