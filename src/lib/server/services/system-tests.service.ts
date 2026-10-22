import { error } from '@sveltejs/kit';
import { POOL } from '$lib/server/database';
import { deliverEmail, isMailConfigured } from '$lib/server/mail';
import { requireInfraPermission } from '$lib/server/permissions';
import { StorageNotConfiguredError, testStorage } from '$lib/server/storage';
import { audit } from './audit.service';
import { logger } from '$lib/server/logger';

/** Sends a short test email to the admin's own address. 409 when mail is not set up, 502 when it is refused. */
export async function sendTestMail(userId: string): Promise<{ to: string }> {
	await requireInfraPermission(userId, 'settings.manage');
	if (!(await isMailConfigured())) throw error(409, 'Mail is not set up. Set a sending domain first.');

	const admin = await POOL.query<{ email: string }>(`SELECT email FROM auth.user WHERE id = $1`, [userId]);
	const to = admin.rows[0]?.email;
	if (!to) throw error(404, 'Your account has no email address.');

	try {
		await deliverEmail(to, 'system.test', 'Test email', '<p>Mail is working. You can ignore this message.</p>');
	} catch (e) {
		logger.error({ err: e, adminId: userId }, '[system-tests] Mail server refused the test email');
		throw error(502, 'The mail server did not accept the email. The email log has the details.');
	}
	await audit(userId, 'mail.test', { type: 'system' }, { to });
	return { to };
}

/** Writes and removes a probe object in the bucket. 409 when storage is not set up, 502 when it is unreachable. */
export async function testStorageConnection(userId: string): Promise<void> {
	await requireInfraPermission(userId, 'settings.manage');
	try {
		await testStorage();
	} catch (e) {
		if (e instanceof StorageNotConfiguredError) throw error(409, e.message);
		logger.error({ err: e, adminId: userId }, '[system-tests] Storage probe could not reach the bucket');
		throw error(502, 'The bucket could not be reached with these settings. Check the endpoint, bucket, and keys.');
	}
	await audit(userId, 'storage.test', { type: 'system' });
}
