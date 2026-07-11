import { connect, headers } from "@nats-io/transport-node";
import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";

export async function POST({ locals }) {
	
	if (!locals.organization) {
		return json({ error: 'Unauthorized.' }, { status: 401 });
	}

	if (!locals.organization.role) {
		return json({ error: 'Forbidden.' }, { status: 403 });
	}

	const natsConnection = await connect();
	const requestHeaders = headers()
	requestHeaders.append('Access-Token', 'JWT')
	requestHeaders.append('Job-Id', nanoid())

	const payload = {
		area: {}
	}

	natsConnection.publish('downloads.request', JSON.stringify(payload), {
		headers: requestHeaders
	})
}