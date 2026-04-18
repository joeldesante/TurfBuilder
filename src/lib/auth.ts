import { betterAuth } from 'better-auth';
import { env } from '$env/dynamic/private';
import { twoFactor, username } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { organization } from 'better-auth/plugins';
import { admin } from 'better-auth/plugins';
import { ac, userRole } from '$lib/permissions';
import config from '$config';
import { POOL, AUTH_POOL } from '$lib/server/database.js';

export const auth = betterAuth({
	database: AUTH_POOL,
	emailAndPassword: {
		enabled: true
	},

	user: {
		fields: {
			emailVerified: 'email_verified',
			createdAt: 'created_at',
			updatedAt: 'updated_at'
		}
	},
	session: {
		fields: {
			userId: 'user_id',
			ipAddress: 'ip_address',
			userAgent: 'user_agent',
			expiresAt: 'expires_at',
			createdAt: 'created_at',
			updatedAt: 'updated_at'
		}
	},
	account: {
		fields: {
			userId: 'user_id',
			accountId: 'account_id',
			providerId: 'provider_id',
			accessToken: 'access_token',
			refresh_token: 'refresh_token',
			accessTokenExpiresAt: 'access_token_expires_at',
			refreshTokenExpiresAt: 'refresh_token_expires_at',
			idToken: 'id_token',
			createdAt: 'created_at',
			updatedAt: 'updated_at'
		}
	},
	verification: {
		fields: {
			expiresAt: 'expires_at',
			createdAt: 'created_at',
			updatedAt: 'updated_at'
		}
	},

	plugins: [
		sveltekitCookies(getRequestEvent),
		username({
			schema: {
				user: {
					fields: {
						displayUsername: 'display_username'
					}
				}
			}
		}),
		twoFactor({
			schema: {
				twoFactor: {
					modelName: 'two_factor',
					fields: {
						userId: 'user_id',
						backupCodes: 'backup_codes'
					}
				},
				user: {
					fields: {
						twoFactorEnabled: 'two_factor_enabled'
					}
				}
			}
		}),
		organization({
			organizationCreation: {
				afterCreate: async ({ organization, member }) => {
					const client = await POOL.connect();

					async function insertPerms(roleId: string, keys: string[]) {
						if (keys.length === 0) return;
						const placeholders = keys.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ');
						const values: string[] = [roleId];
						for (const key of keys) {
							const [resource, action] = key.split(':');
							values.push(resource, action);
						}
						await client.query(
							`INSERT INTO org_role_permission (role_id, resource, action) VALUES ${placeholders}`,
							values
						);
					}

					try {
						await client.query('BEGIN');

						// 1. Administrator (Owner) — all permissions via is_owner bypass
						const adminResult = await client.query(
							`INSERT INTO org_role (org_id, name, is_owner, is_default)
							 VALUES ($1, 'Administrator', true, false) RETURNING id`,
							[organization.id]
						);
						const adminId = adminResult.rows[0].id;

						// 2. Organizer — cuts turfs, manages surveys, onboards members
						const organizerResult = await client.query(
							`INSERT INTO org_role (org_id, name, is_owner, is_default)
							 VALUES ($1, 'Organizer', false, false) RETURNING id`,
							[organization.id]
						);
						await insertPerms(organizerResult.rows[0].id, [
							'canvass:use',
							'turf:read', 'turf:create', 'turf:update', 'turf:delete',
							'survey:read', 'survey:create', 'survey:update', 'survey:delete',
							'response:read', 'response:delete',
							'member:read', 'member:update', 'member:delete'
						]);

						// 3. Analyst — read-only access to data and reports
						const analystResult = await client.query(
							`INSERT INTO org_role (org_id, name, is_owner, is_default)
							 VALUES ($1, 'Analyst', false, false) RETURNING id`,
							[organization.id]
						);
						await insertPerms(analystResult.rows[0].id, [
							'turf:read',
							'survey:read',
							'response:read'
						]);

						// 4. Volunteer — field canvasser; default role for new members
						const volunteerResult = await client.query(
							`INSERT INTO org_role (org_id, name, is_owner, is_default)
							 VALUES ($1, 'Standard User', false, true) RETURNING id`,
							[organization.id]
						);
						await insertPerms(volunteerResult.rows[0].id, ['canvass:use']);

						// Assign org creator to Administrator role
						await client.query(
							`INSERT INTO org_user_role (org_id, user_id, role_id) VALUES ($1, $2, $3)`,
							[organization.id, member.userId, adminId]
						);

						await client.query('COMMIT');
					} catch (err) {
						await client.query('ROLLBACK');
						throw err;
					} finally {
						client.release();
					}
				}
			},
			schema: {
				organization: {
					fields: {
						createdAt: 'created_at'
					}
				},
				member: {
					fields: {
						userId: 'user_id',
						organizationId: 'organization_id',
						createdAt: 'created_at'
					}
				},
				invitation: {
					fields: {
						inviterId: 'inviter_id',
						organizationId: 'organization_id',
						createdAt: 'created_at',
						expiresAt: 'expires_at'
					}
				},
				session: {
					fields: {
						activeOrganizationId: 'active_organization_id',
						activeTeamId: 'active_team_id'
					}
				}
			}
		}),
		admin({
			ac,
			roles: {
				user: userRole
			},
			defaultRole: 'user',
			adminRoles: [],
			schema: {
				user: {
					fields: {
						banReason: 'ban_reason',
						banExpires: 'ban_expires',
						impersonatedBy: 'impersonated_by'
					}
				}
			}
		})
	],
	trustedOrigins: async (_) => {
		return config.base_origins;
	},
	advanced: {
		database: {
			generateId: false
		}
	}
});
