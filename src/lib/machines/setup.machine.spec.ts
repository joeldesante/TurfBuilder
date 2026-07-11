import { describe, expect, test } from 'vitest';
import { createActor } from 'xstate';
import { machine } from './setup.machine';

function startActor() {
	return createActor(machine).start();
}

describe('setup machine', () => {
	test('starts at database connection check', () => {
		const actor = startActor();
		expect(actor.getSnapshot().value).toBe('Confirm Database Connection');
	});

	test('connection failure routes to help, retry returns', () => {
		const actor = startActor();
		actor.send({ type: 'DB_CONNECTION_FAILURE' });
		expect(actor.getSnapshot().value).toBe('Database Help');
		actor.send({ type: 'RETRY' });
		expect(actor.getSnapshot().value).toBe('Confirm Database Connection');
	});

	test('schema error routes to error display, retry returns', () => {
		const actor = startActor();
		actor.send({ type: 'DB_CONNECTION_SUCCESS' });
		actor.send({ type: 'SCHEMA_SETUP_ERROR' });
		expect(actor.getSnapshot().value).toBe('Error Display');
		actor.send({ type: 'RETRY' });
		expect(actor.getSnapshot().value).toBe('Database Schema Setup');
	});

	test('form steps wait for explicit events instead of auto-advancing', () => {
		const actor = startActor();
		actor.send({ type: 'DB_CONNECTION_SUCCESS' });
		actor.send({ type: 'SCHEMA_SETUP_SUCCESS' });
		// Must sit on the base URL step until NEXT is sent.
		expect(actor.getSnapshot().value).toBe("Configure Base URL's");
		actor.send({ type: 'NEXT' });
		expect(actor.getSnapshot().value).toBe('Select Email Mode');
	});

	test('multi-tenant path reaches Finished via overture host selection', () => {
		const actor = startActor();
		actor.send({ type: 'DB_CONNECTION_SUCCESS' });
		actor.send({ type: 'SCHEMA_SETUP_SUCCESS' });
		actor.send({ type: 'NEXT' }); // base URLs
		actor.send({ type: 'AWS_SES' });
		actor.send({ type: 'NEXT' }); // SES config
		actor.send({ type: 'NEXT' }); // admin account
		actor.send({ type: 'NEXT' }); // customizations
		actor.send({ type: 'NEXT' }); // map tile server
		actor.send({ type: 'MULTI_TENANT' });
		expect(actor.getSnapshot().value).toBe('Allow Anyone to Create an Org');
		actor.send({ type: 'NEXT' });
		expect(actor.getSnapshot().value).toBe('Select Overture Host');
		actor.send({ type: 'SELF_HOSTED' });
		expect(actor.getSnapshot().value).toBe('Configure NATs URL for Overture');
		actor.send({ type: 'NEXT' });
		expect(actor.getSnapshot().value).toBe('Finished');
		expect(actor.getSnapshot().status).toBe('done');
	});

	test('single-tenant simple mode can skip TBI connection', () => {
		const actor = startActor();
		actor.send({ type: 'DB_CONNECTION_SUCCESS' });
		actor.send({ type: 'SCHEMA_SETUP_SUCCESS' });
		actor.send({ type: 'NEXT' });
		actor.send({ type: 'DIRECT_SEND' });
		actor.send({ type: 'NEXT' });
		actor.send({ type: 'NEXT' });
		actor.send({ type: 'NEXT' });
		actor.send({ type: 'NEXT' });
		actor.send({ type: 'SINGLE_TENANT' });
		expect(actor.getSnapshot().value).toBe('Single: Select Application Complexity');
		actor.send({ type: 'SIMPLE_MODE' });
		expect(actor.getSnapshot().value).toBe('ST: Connect TurfBuilder Infrastructure Account');
		actor.send({ type: 'SKIP' });
		expect(actor.getSnapshot().value).toBe('Finished');
	});

	test('disabling overture finishes the wizard', () => {
		const actor = startActor();
		actor.send({ type: 'DB_CONNECTION_SUCCESS' });
		actor.send({ type: 'SCHEMA_SETUP_SUCCESS' });
		actor.send({ type: 'NEXT' });
		actor.send({ type: 'AWS_SES' });
		actor.send({ type: 'NEXT' });
		actor.send({ type: 'NEXT' });
		actor.send({ type: 'NEXT' });
		actor.send({ type: 'NEXT' });
		actor.send({ type: 'MULTI_TENANT' });
		actor.send({ type: 'NEXT' });
		actor.send({ type: 'DISABLE_OVERTURE' });
		expect(actor.getSnapshot().value).toBe('Finished');
	});
});
