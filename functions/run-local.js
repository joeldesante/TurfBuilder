'use strict';

// Calls a function the way DigitalOcean does: main(args), then prints what it returned.
//   node --env-file=.env run-local.js import-contacts '{"orgId":"...","jobId":"..."}'

const path = require('node:path');

async function run() {
	const [name, json = '{}'] = process.argv.slice(2);
	if (!name) {
		console.error('Usage: node --env-file=.env run-local.js <function> [json args]');
		process.exit(2);
	}

	const entry = path.join(__dirname, 'packages', 'imports', name, 'index.js');
	const { main } = require(entry);

	const started = Date.now();
	const result = await main(JSON.parse(json));
	console.log(JSON.stringify(result, null, 2));
	console.log(`took ${Date.now() - started} ms`);
	// The function keeps its database pool open for warm calls. Locally, just exit.
	process.exit(result?.statusCode >= 400 ? 1 : 0);
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
