import { error } from '@sveltejs/kit';
import { POOL } from '$lib/server/database';
import { convertAllBucketFilters } from '$lib/server/services/buckets.service';
import { SETUP_STEPS } from '$lib/server/setup-schema';
import { resolveInfraPermissions } from '$lib/server/permissions';
import { backfillActivity, pruneActivity } from '$lib/server/services/activity.service';
import { recordSchemaFingerprint } from '$lib/server/services/migrations.service';
import type { RequestHandler } from './$types';

/**
 * Runs every schema step, then the data steps (legacy bucket filter conversion,
 * activity backfill, activity pruning), streaming progress as server-sent events.
 * Safe to rerun on an existing database.
 *
 * @auth infra settings.manage
 * @returns `text/event-stream` of `{ step, total, label, status, error?, detail? }`, ending with `{ done: true }`. 401 when signed out, 403 without settings.manage
 */
export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const infraPermissions = await resolveInfraPermissions(locals.user.id);
	if (!infraPermissions.includes('settings.manage')) {
		throw error(403, 'Forbidden');
	}

	const encoder = new TextEncoder();
	// The schema steps, then the data steps: converting legacy bucket filters,
	// backfilling activity history, and pruning activity past its retention.
	const total = SETUP_STEPS.length + 3;

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

			// Buckets made before the filter editor are converted to its format. The
			// ones that cannot be are listed, since they need rebuilding by hand.
			const conversion = { step: SETUP_STEPS.length + 1, total, label: 'Converting legacy bucket filters' };
			send({ ...conversion, status: 'running' });
			try {
				const report = await convertAllBucketFilters();
				send({
					...conversion,
					status: 'done',
					detail: [
						`${report.converted} converted, ${report.alreadyDone} already converted.`,
						...report.failed.map((f) => `Could not convert "${f.slug}": ${f.reason}`)
					]
				});
			} catch (e) {
				send({ ...conversion, status: 'error', error: String(e) });
				controller.close();
				return;
			}

			// History from before activity was recorded, so the infra charts start
			// with real data. Safe to rerun.
			const backfill = { step: SETUP_STEPS.length + 2, total, label: 'Backfilling activity history' };
			send({ ...backfill, status: 'running' });
			try {
				const report = await backfillActivity();
				const added = Object.values(report.inserted).reduce((sum, n) => sum + (n ?? 0), 0);
				send({
					...backfill,
					status: 'done',
					detail: [`${added} events and ${report.activeDays} active days added.`]
				});
			} catch (e) {
				send({ ...backfill, status: 'error', error: String(e) });
				controller.close();
				return;
			}

			const prune = { step: total, total, label: 'Removing activity past its retention' };
			send({ ...prune, status: 'running' });
			try {
				const removed = await pruneActivity();
				await recordSchemaFingerprint();
				send({ ...prune, status: 'done', detail: [`${removed} old events removed.`] });
			} catch (e) {
				send({ ...prune, status: 'error', error: String(e) });
				controller.close();
				return;
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
