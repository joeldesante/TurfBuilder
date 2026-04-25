import { error } from '@sveltejs/kit';
import { POOL } from '$lib/server/database';
import { SETUP_STEPS } from '$lib/server/setup-schema';
import { resolveInfraPermissions } from '$lib/server/permissions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const infraPermissions = await resolveInfraPermissions(locals.user.id);
	if (!infraPermissions.includes('settings.manage')) {
		throw error(403, 'Forbidden');
	}

	const encoder = new TextEncoder();
	const total = SETUP_STEPS.length;

	const stream = new ReadableStream({
		async start(controller) {
			function send(data: object) {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
			}

			for (let i = 0; i < SETUP_STEPS.length; i++) {
				const step = SETUP_STEPS[i];
				send({ step: i + 1, total, label: step.label, status: 'running' });

				const client = await POOL.connect();
				try {
					for (const sql of step.statements) {
						try {
							await client.query(sql);
						} catch (e) {
							const msg = String(e).toLowerCase();
							if (
								msg.includes('already exists') ||
								msg.includes('duplicate') ||
								(e as { code?: string }).code === '42P07' ||
								(e as { code?: string }).code === '42710'
							) {
								continue;
							}
							throw e;
						}
					}
					send({ step: i + 1, total, label: step.label, status: 'done' });
				} catch (e) {
					send({ step: i + 1, total, label: step.label, status: 'error', error: String(e) });
					client.release();
					controller.close();
					return;
				}
				client.release();
			}

			send({ done: true });
			controller.close();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
