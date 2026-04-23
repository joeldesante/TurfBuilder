import { POOL } from './database';

// Once true, never becomes false — setup doesn't undo itself.
let _setupComplete: boolean | null = null;

export async function isSetupComplete(): Promise<boolean> {
	if (_setupComplete === true) return true;
	try {
		const result = await POOL.query<{ count: number }>(
			`SELECT COUNT(*)::int AS count FROM auth.user`
		);
		const complete = result.rows[0].count > 0;
		if (complete) _setupComplete = true;
		return complete;
	} catch {
		return false;
	}
}

export function markSetupComplete(): void {
	_setupComplete = true;
}
