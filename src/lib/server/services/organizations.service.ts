import { error } from '@sveltejs/kit';
import { getAuth } from '$lib/auth';
import { POOL } from '$lib/server/database';
import { canInfra } from '$lib/server/permissions';
import { requireActiveMembership } from '$lib/server/list-access';
import { analytics } from '$lib/server/analytics';
import { getOrg } from './platform-organizations.service';
import type { PlatformOrgDetail } from '$lib/shared/types/platform-organizations';

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

/** Editing an organization is limited to its owners; there is no organization.update permission key. */
async function requireOwner(userId: string, orgId: string): Promise<void> {
	const { role } = await requireActiveMembership(userId, orgId);
	if (
		!role
			.split(',')
			.map((r) => r.trim())
			.includes('owner')
	)
		throw error(403, 'Forbidden');
}

/**
 * Whether no organization uses `slug`. Deleted and suspended organizations keep their slug, so
 * those count as taken. Slugs are public in every org URL, so this reveals nothing new.
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
	const taken = await POOL.query(`SELECT 1 FROM auth.organization WHERE slug = $1`, [slug]);
	return !taken.rowCount;
}

/** Whether people may create organizations themselves (the `organizations.allow_creation` system setting). */
export async function isOrgCreationAllowed(): Promise<boolean> {
	const setting = await POOL.query<{ value: string }>(
		`SELECT value FROM system_setting WHERE key = 'organizations.allow_creation'`
	);
	return setting.rows[0]?.value === 'true';
}

/**
 * Creates an organization with the caller as its owner. Goes through
 * better-auth, which also creates the default roles, so it needs the request's
 * headers to identify the session. 403 when creation is disabled in system
 * settings, 409 when the slug is taken.
 */
export async function createOrganization(
	userId: string,
	input: OrganizationInput,
	headers: Headers
): Promise<Organization> {
	if (!(await isOrgCreationAllowed())) {
		throw error(403, 'Organization creation is currently disabled.');
	}

	if (!(await isSlugAvailable(input.slug))) {
		throw error(409, 'An organization with that slug already exists');
	}

	const auth = await getAuth();
	const created = await auth.api.createOrganization({ headers, body: input });

	analytics.capture(userId, 'organization_created', { organization_id: created.id });

	return {
		id: created.id,
		name: created.name,
		slug: created.slug,
		created_at: String(created.createdAt)
	};
}

/**
 * One organization. 404 unless the caller is a member. Infra admins with
 * `access` can read any organization, and theirs carries `platform`: who runs
 * it, its size, activity, and plugins.
 */
export async function getOrganization(
	userId: string,
	orgId: string
): Promise<Organization & { platform?: PlatformOrgDetail }> {
	const infra = await canInfra(userId, 'access');
	if (!infra) await requireActiveMembership(userId, orgId);

	const result = await POOL.query<Organization>(
		`SELECT ${COLUMNS} FROM auth.organization o WHERE o.id = $1`,
		[orgId]
	);
	if (result.rowCount === 0) throw error(404, 'Organization not found');
	return infra ? { ...result.rows[0], platform: await getOrg(userId, orgId) } : result.rows[0];
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
