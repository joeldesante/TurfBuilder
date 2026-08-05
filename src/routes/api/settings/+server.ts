import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { resolveInfraPermissions } from '$lib/server/permissions';
import {
	getSettings,
	commitSettings,
	SettingsSchema
} from '$lib/server/services/settings.service';
import { logger } from '$lib/server/logger';

async function requireSettingsManager(userId: string | undefined) {
	if (!userId) throw error(401, 'Unauthorized');
	const infraPermissions = await resolveInfraPermissions(userId);
	if (!infraPermissions.includes('settings.manage')) {
		throw error(403, 'Forbidden');
	}
}

// Return the full settings blob. Readable without auth while setup is
// incomplete (no users exist yet); requires infra settings.manage afterward.
export async function GET({ locals }) {
	const setupComplete = locals.settings?.setupComplete === true;
	if (setupComplete) {
		await requireSettingsManager(locals.user?.id);
	}

	try {
		const settings = await getSettings();
		return json(settings);
	} catch {
		// getSettings throws when no settings row exists yet.
		throw error(404, 'Settings have not been initialized');
	}
}

// Setup-only: create the initial settings and mark setup complete. Rejected
// once setup has already been completed (use PUT to modify existing settings).
export async function POST({ request, locals }) {
	if (locals.settings?.setupComplete === true) {
		throw error(409, 'Setup has already been completed');
	}

	const parsed = SettingsSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		throw error(400, z.prettifyError(parsed.error));
	}

	// Completing the wizard is what marks the instance as set up.
	const settings = await commitSettings({ ...parsed.data, setupComplete: true });
	logger.info('Initial settings committed; setup complete');
	return json(settings, { status: 201 });
}

// Replace the full settings blob. Requires infra settings.manage.
export async function PUT({ request, locals }) {
	await requireSettingsManager(locals.user?.id);

	const parsed = SettingsSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		throw error(400, z.prettifyError(parsed.error));
	}

	const settings = await commitSettings(parsed.data);
	return json(settings);
}
