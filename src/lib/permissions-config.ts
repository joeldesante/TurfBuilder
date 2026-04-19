export interface PermissionDef {
	key: string;
	group: string;
	label: string;
	verbPhrase: string;
	description: string;
}

export const PERMISSIONS: PermissionDef[] = [
	{
		key: 'system.access',
		group: 'System',
		label: 'Staff Dashboard Access',
		verbPhrase: 'access the staff dashboard',
		description: 'Grants access to the staff dashboard (/s/). Required to manage the organization. Always enabled for Administrator roles.'
	},

	{
		key: 'canvass.use',
		group: 'Canvassing',
		label: 'Canvass',
		verbPhrase: 'canvass',
		description:
			'Allows entering turf codes and using the canvassing app to collect responses in the field. Disabling this prevents the user from accessing any canvassing functionality.'
	},

	{
		key: 'turf.read',
		group: 'Turfs',
		label: 'View Turfs',
		verbPhrase: 'view all turfs in the organization',
		description:
			'Grants access to the Turfs page to see the full list of canvassing areas and their assignments.'
	},
	{
		key: 'turf.create',
		group: 'Turfs',
		label: 'Cut New Turfs',
		verbPhrase: 'cut and create new turfs',
		description: 'Allows drawing and defining new turf boundaries using the map tool.'
	},
	{
		key: 'turf.update',
		group: 'Turfs',
		label: 'Edit Turfs',
		verbPhrase: 'edit existing turfs',
		description:
			'Allows renaming and modifying the boundaries of turfs that have already been created.'
	},
	{
		key: 'turf.delete',
		group: 'Turfs',
		label: 'Delete Turfs',
		verbPhrase: 'delete turfs once they have been created',
		description: 'Allows permanently removing turfs from the organization.'
	},

	{
		key: 'survey.read',
		group: 'Surveys',
		label: 'View Surveys',
		verbPhrase: 'view all surveys in the organization',
		description: 'Grants access to the Surveys page to browse all survey templates.'
	},
	{
		key: 'survey.create',
		group: 'Surveys',
		label: 'Create Surveys',
		verbPhrase: 'create new surveys',
		description: 'Allows building new survey templates for canvassers to use in the field.'
	},
	{
		key: 'survey.update',
		group: 'Surveys',
		label: 'Edit Surveys',
		verbPhrase: 'edit survey questions and settings',
		description:
			'Allows modifying the questions, answers, and settings of existing surveys.'
	},
	{
		key: 'survey.delete',
		group: 'Surveys',
		label: 'Delete Surveys',
		verbPhrase: 'delete surveys',
		description: 'Allows permanently removing surveys and all of their associated questions.'
	},

	{
		key: 'response.read',
		group: 'Responses',
		label: 'View Responses',
		verbPhrase: 'view canvassing response data',
		description: 'Grants access to the Responses page to see all data collected in the field.'
	},
	{
		key: 'response.delete',
		group: 'Responses',
		label: 'Delete Responses',
		verbPhrase: 'delete individual responses',
		description:
			'Allows permanently removing individual canvassing responses from the organization.'
	},

	{
		key: 'member.read',
		group: 'Members',
		label: 'View Members',
		verbPhrase: 'view the member list',
		description:
			'Grants access to the Members page to see who belongs to the organization.'
	},
	{
		key: 'member.invite',
		group: 'Members',
		label: 'Invite Members',
		verbPhrase: 'create and manage invite links',
		description: 'Allows creating token-based invite links and toggling the open slug invite for the organization.'
	},
	{
		key: 'member.update',
		group: 'Members',
		label: 'Manage Member Roles',
		verbPhrase: 'assign and change the roles of other members',
		description: 'Allows changing the role assigned to any member within the organization.'
	},
	{
		key: 'member.delete',
		group: 'Members',
		label: 'Remove Members',
		verbPhrase: 'remove members from the organization',
		description: 'Allows kicking members out of the organization entirely.'
	},

	{
		key: 'plugin.manage',
		group: 'Plugins',
		label: 'Manage Plugins',
		verbPhrase: 'install, configure, and remove plugins',
		description:
			'Allows enabling and disabling plugins and changing their configuration for this organization.'
	},

	{
		key: 'role.read',
		group: 'Roles',
		label: 'View Roles',
		verbPhrase: 'view all permission roles',
		description: 'Grants access to the Roles settings page to view all permission groups.'
	},
	{
		key: 'role.create',
		group: 'Roles',
		label: 'Create Roles',
		verbPhrase: 'create new permission roles',
		description: 'Allows creating new permission groups (roles) within the organization.'
	},
	{
		key: 'role.update',
		group: 'Roles',
		label: 'Edit Roles',
		verbPhrase: 'edit role names and permissions',
		description: 'Allows modifying the name, weight, and permission entries of existing roles.'
	},
	{
		key: 'role.delete',
		group: 'Roles',
		label: 'Delete Roles',
		verbPhrase: 'delete permission roles',
		description: 'Allows permanently removing permission groups from the organization.'
	}
];

export const VALID_PERMISSION_KEYS = new Set(PERMISSIONS.map((p) => p.key));

export const PERMISSION_GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))].map((group) => ({
	name: group,
	permissions: PERMISSIONS.filter((p) => p.group === group)
}));
