import { betterAuth } from 'better-auth';
import { env } from '$env/dynamic/private';
import { twoFactor, username } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { organization } from 'better-auth/plugins';
import { admin } from 'better-auth/plugins';
import { ac, userRole } from '$lib/permissions';
import config from '$config';
import { POOL, AUTH_POOL, withOrgTransaction } from '$lib/server/database.js';

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
			organizationHooks: {
				afterCreateOrganization: async ({ organization, member }) => {
					console.log('[afterCreateOrganization] fired for org', organization.id, 'member', member.id);
					try {
						await withOrgTransaction(organization.id, async (client) => {
						async function insertPerms(roleId: string, keys: string[]) {
							if (keys.length === 0) return;
							await client.query(
								`INSERT INTO permission_role_entry (role_id, registered_permission_id, value)
								 SELECT $1, id, true FROM registered_permission WHERE key = ANY($2::text[])`,
								[roleId, keys]
							);
						}

						// 1. Administrator — all org permissions
						const { rows: [{ id: adminId }] } = await client.query(
							`INSERT INTO permission_role (name, weight, scope, organization_id, is_default)
							 VALUES ('Administrator', 0, 'organization', $1, false) RETURNING id`,
							[organization.id]
						);
						const { rows: allOrgPerms } = await client.query(
							`SELECT key FROM registered_permission WHERE scope = 'organization'`
						);
						await insertPerms(adminId, allOrgPerms.map((r: { key: string }) => r.key));

						// 2. Organizer — cuts turfs, manages surveys, onboards members
						const { rows: [{ id: organizerId }] } = await client.query(
							`INSERT INTO permission_role (name, weight, scope, organization_id, is_default)
							 VALUES ('Organizer', 100, 'organization', $1, false) RETURNING id`,
							[organization.id]
						);
						await insertPerms(organizerId, [
							'system.access',
							'canvass.use',
							'turf.read', 'turf.create', 'turf.update', 'turf.delete',
							'survey.read', 'survey.create', 'survey.update', 'survey.delete',
							'response.read', 'response.delete',
							'member.read', 'member.update', 'member.delete'
						]);

						// 3. Analyst — read-only access to data and reports
						const { rows: [{ id: analystId }] } = await client.query(
							`INSERT INTO permission_role (name, weight, scope, organization_id, is_default)
							 VALUES ('Analyst', 200, 'organization', $1, false) RETURNING id`,
							[organization.id]
						);
						await insertPerms(analystId, ['system.access', 'turf.read', 'survey.read', 'response.read']);

						// 4. Everyone — default role, auto-assigned to all new members
						const { rows: [{ id: everyoneId }] } = await client.query(
							`INSERT INTO permission_role (name, weight, scope, organization_id, is_default)
							 VALUES ('Everyone', 999, 'organization', $1, true) RETURNING id`,
							[organization.id]
						);
						await insertPerms(everyoneId, ['canvass.use']);

						// Assign org creator to Administrator and Everyone
						// (the Everyone trigger does not fire because the member row was created
						// before the Everyone role existed, so we assign manually here)
						await client.query(
							`INSERT INTO user_role_membership (user_id, member_id, role_id) VALUES ($1, $2, $3)`,
							[member.userId, member.id, adminId]
						);
						await client.query(
							`INSERT INTO user_role_membership (user_id, member_id, role_id) VALUES ($1, $2, $3)`,
							[member.userId, member.id, everyoneId]
						);
					});
					} catch (err) {
						console.error('[afterCreateOrganization] error:', err);
						throw err;
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
