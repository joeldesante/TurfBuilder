import { SETTING_GROUPS, type SettingGroup } from '$lib/shared/registries/system-settings';
import { getCredentialStatus, getSystemSettings } from '$lib/server/services/system-settings.service';

export async function load({ locals, url }) {
	const userId = locals.user!.id;
	const requested = url.searchParams.get('tab');
	const tab: SettingGroup = SETTING_GROUPS.find((g) => g.id === requested)?.id ?? 'general';

	const [settings, credentials] = await Promise.all([getSystemSettings(userId), getCredentialStatus(userId)]);
	return { settings, credentials, tab };
}
