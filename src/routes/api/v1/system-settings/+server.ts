import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/list-access';
import { parseSettingsUpdate } from '$lib/shared/registries/system-settings';
import { getSystemSettings, updateSystemSettings } from '$lib/server/services/system-settings.service';

/**
 * Every registered system setting with its stored value, or its default when it has never been saved.
 *
 * @auth infra settings.manage
 * @returns `SystemSettingValue[]`. 401 when signed out, 403 without settings.manage
 */
export const GET: RequestHandler = async ({ locals }) => {
	return json(await getSystemSettings(requireUser(locals)));
};

/**
 * Saves any subset of settings. Each value is checked against its own definition, and nothing is saved if any is invalid.
 *
 * @auth infra settings.manage
 * @body {object} - Setting keys mapped to their new text values
 * @returns `{ saved: string[], restartRequired: boolean }`. 400 with `errors` mapping each bad key to a message, 403 without settings.manage
 */
export const PATCH: RequestHandler = async ({ locals, request }) => {
	const userId = requireUser(locals);
	const parsed = parseSettingsUpdate(await request.json().catch(() => null));
	if (!parsed.success) {
		return json({ message: Object.values(parsed.errors)[0] ?? 'Invalid settings', errors: parsed.errors }, { status: 400 });
	}
	return json(await updateSystemSettings(userId, parsed.data));
};
