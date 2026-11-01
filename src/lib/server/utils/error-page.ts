import { ERROR_CODES, type ErrorCode } from '$lib/shared/registries/error-codes';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * A plain page for an error the app cannot render itself, such as a database
 * that is not migrated. It stands alone: no layout, scripts, or bundled CSS,
 * only the logo from /logos, so it works while the rest of the app cannot.
 */
export function errorPage(code: ErrorCode): Response {
	const { status, message } = ERROR_CODES[code];
	const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${status}</title>
<style>
body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 1rem; box-sizing: border-box; text-align: center; font-family: system-ui, sans-serif; }
img { width: 14rem; max-width: 70vw; height: auto; margin-bottom: 1.5rem; }
h1 { margin: 0; font-size: 3rem; }
p { margin: 1rem 0 0; max-width: 28rem; line-height: 1.5; }
small { margin-top: 1.5rem; opacity: 0.6; }
</style>
</head>
<body>
<img src="/logos/default-logo.svg" alt="TurfBuilder" />
<h1>${status}</h1>
<p>${escapeHtml(message)}</p>
<small>${code}</small>
</body>
</html>`;
	return new Response(html, {
		status,
		headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
	});
}
