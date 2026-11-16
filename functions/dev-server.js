'use strict';

// A local stand-in for DigitalOcean's function invoke API, for the app's server to call in dev.
//   POST /api/v1/namespaces/_/actions/<package>/<function>[?blocking=true]
// The body is the function's args as JSON. Like DigitalOcean, the default is non-blocking:
// it answers 202 with an activationId at once and runs the function in the background.
// With blocking=true it waits and answers with the function's result.
// Requests need the same Basic auth header the real API wants: the key is FUNCTIONS_LOCAL_KEY.

const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.FUNCTIONS_LOCAL_PORT) || 3233;
const KEY = process.env.FUNCTIONS_LOCAL_KEY;
const ROUTE = /^\/api\/v1\/namespaces\/[^/]+\/actions\/([\w-]+)\/([\w-]+)$/;

if (!KEY) {
	console.error('Set FUNCTIONS_LOCAL_KEY (any secret string) so the local server is not open.');
	process.exit(1);
}

function authorized(header) {
	const given = Buffer.from(String(header ?? '').replace(/^Basic /, ''), 'base64').toString();
	const a = Buffer.from(given);
	const b = Buffer.from(KEY);
	return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function send(res, status, body) {
	res.writeHead(status, { 'content-type': 'application/json' });
	res.end(JSON.stringify(body));
}

async function readJson(req) {
	let raw = '';
	for await (const chunk of req) raw += chunk;
	return raw ? JSON.parse(raw) : {};
}

function load(pkg, name) {
	const dir = path.join(__dirname, 'packages', pkg, name);
	const entry = path.join(dir, 'index.js');
	// Fresh copy each call, so an edit to the function or one of its own files shows up without
	// restarting the server. Installed packages stay cached.
	for (const file of Object.keys(require.cache)) {
		if (file.startsWith(dir + path.sep) && !file.includes(`${path.sep}node_modules${path.sep}`)) {
			delete require.cache[file];
		}
	}
	return require(entry).main;
}

http
	.createServer(async (req, res) => {
		const url = new URL(req.url, 'http://localhost');
		const match = ROUTE.exec(url.pathname);
		if (req.method !== 'POST' || !match) return send(res, 404, { error: 'Not found' });
		if (!authorized(req.headers.authorization)) return send(res, 401, { error: 'Unauthorized' });

		let main;
		try {
			main = load(match[1], match[2]);
		} catch {
			return send(res, 404, { error: 'No such function' });
		}
		let args;
		try {
			args = await readJson(req);
		} catch {
			return send(res, 400, { error: 'The body must be JSON' });
		}

		const activationId = crypto.randomBytes(16).toString('hex');
		const run = Promise.resolve(main(args)).then(
			(result) => ({ activationId, response: { status: 'success', success: true, result } }),
			(err) => ({
				activationId,
				response: { status: 'application error', success: false, result: { error: err.name } }
			})
		);

		if (url.searchParams.get('blocking') === 'true') return send(res, 200, await run);
		run.then((activation) => console.log(`activation ${activationId}`, activation.response.status));
		send(res, 202, { activationId });
	})
	.listen(PORT, () => console.log(`local functions on http://localhost:${PORT}`));
