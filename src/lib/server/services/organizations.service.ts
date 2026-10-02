import { error } from '@sveltejs/kit';
import { getAuth } from '$lib/auth';
import { POOL } from '$lib/server/database';

export interface OrganizationInput {
	name: string;
	slug: string;
}

export interface Organization extends OrganizationInput {
	id: string;
	created_at: string;
}

const UNIQUE_VIOLATION = '23505';

const COLUMNS = 'o.id, o.name, o.slug, o.created_at';

/** The caller's membership in the org, or a 404 that looks the same as a missing org. */
async function requireMember(userId: string, orgId: string): Promise<{ role: string }> {
	const result = await POOL.query<{ role: string }>(
		`SELECT role FROM auth.member WHERE user_id = $1 AND organization_id = $2`,
		[userId, orgId]
	);
	if (result.rowCount === 0) throw error(404, 'Organization not found');
	return result.rows[0];
}

/** Editing an organization is limited to its owners; there is no organization.update permission key. */
async function requireOwner(userId: string, orgId: string): Promise<void> {
	const { role } = await requireMember(userId, orgId);
	if (
		!role
			.split(',')
			.map((r) => r.trim())
			.includes('owner')
	)
		throw error(403, 'Forbidden');
}

/**
 * Creates an organization with the caller as its owner. Goes through
 * better-auth, which also creates the default roles, so it needs the request's
 * headers to identify the session. 403 when creation is disabled in system
 * settings, 409 when the slug is taken.
 */
export async function createOrganization(
	_userId: string,
	input: OrganizationInput,
	headers: Headers
): Promise<Organization> {
	const setting = await POOL.query<{ value: string }>(
		`SELECT value FROM system_setting WHERE key = 'organizations.allow_creation'`
	);
	if (setting.rows[0]?.value !== 'true') {
		throw error(403, 'Organization creation is currently disabled.');
	}

	const taken = await POOL.query(`SELECT 1 FROM auth.organization WHERE slug = $1`, [input.slug]);
	if (taken.rowCount) throw error(409, 'An organization with that slug already exists');

	const auth = await getAuth();
	const created = await auth.api.createOrganization({ headers, body: input });

	return {
		id: created.id,
		name: created.name,
		slug: created.slug,
		created_at: String(created.createdAt)
	};
}

/** One organization. 404 unless the caller is a member. */
export async function getOrganization(userId: string, orgId: string): Promise<Organization> {
	await requireMember(userId, orgId);

	const result = await POOL.query<Organization>(
		`SELECT ${COLUMNS} FROM auth.organization o WHERE o.id = $1`,
		[orgId]
	);
	if (result.rowCount === 0) throw error(404, 'Organization not found');
	return result.rows[0];
}

/** Replaces an organization's name and slug. Owners only. 409 when the slug is taken. */
export async function replaceOrganization(
	userId: string,
	orgId: string,
	input: OrganizationInput
): Promise<Organization> {
	return updateOrganization(userId, orgId, input);
}

/** Updates the given fields of an organization and leaves the rest as they are. Owners only. 409 when the slug is taken. */
export async function updateOrganization(
	userId: string,
	orgId: string,
	input: Partial<OrganizationInput>
): Promise<Organization> {
	await requireOwner(userId, orgId);

	try {
		const result = await POOL.query<Organization>(
			`UPDATE auth.organization o
			 SET name = COALESCE($2, o.name), slug = COALESCE($3, o.slug)
			 WHERE o.id = $1
			 RETURNING ${COLUMNS}`,
			[orgId, input.name ?? null, input.slug ?? null]
		);
		if (result.rowCount === 0) throw error(404, 'Organization not found');
		return result.rows[0];
	} catch (e) {
		if ((e as { code?: string })?.code === UNIQUE_VIOLATION) {
			throw error(409, 'An organization with that slug already exists');
		}
		throw e;
	}
}
