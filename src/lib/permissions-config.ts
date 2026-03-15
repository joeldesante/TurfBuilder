export const ALL_ACTIONS = ['create', 'read', 'update', 'delete'] as const;
export type Action = (typeof ALL_ACTIONS)[number];

export const PERMISSION_RESOURCES: { resource: string; label: string; actions: Action[] }[] = [
	{ resource: 'turf', label: 'Turfs', actions: ['create', 'read', 'update', 'delete'] },
	{ resource: 'survey', label: 'Surveys', actions: ['create', 'read', 'update', 'delete'] },
	{ resource: 'response', label: 'Responses', actions: ['read', 'delete'] },
	{ resource: 'member', label: 'Members', actions: ['create', 'read', 'update', 'delete'] },
	{ resource: 'role', label: 'Roles', actions: ['create', 'read', 'update', 'delete'] }
];
