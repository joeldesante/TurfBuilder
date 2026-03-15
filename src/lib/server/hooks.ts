import { POOL } from '$lib/server/database';
import { getActivePlugins } from '$lib/server/plugins';
import type { PluginHooks } from '$plugins/types';

/**
 * Fire a lifecycle hook across all active plugins for an org.
 * Errors from individual plugins are swallowed so a broken plugin
 * never crashes the main request.
 */
export async function fireHook<K extends keyof PluginHooks>(
	hookName: K,
	orgId: string,
	userId: string,
	userRole: App.Locals['organization']['role'],
	...args: Parameters<NonNullable<PluginHooks[K]>> extends [...infer A, any] ? A : never
): Promise<void> {
	const plugins = await getActivePlugins(orgId);
	await Promise.allSettled(
		plugins.map(({ manifest, config }) => {
			const hook = manifest.hooks?.[hookName] as
				| ((...a: unknown[]) => Promise<void>)
				| undefined;
			if (!hook) return;
			const ctx = { db: POOL, orgId, userId, userRole, config };
			return hook(...(args as unknown[]), ctx);
		})
	);
}
