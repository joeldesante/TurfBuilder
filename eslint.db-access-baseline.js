/**
 * Files that still reach the database directly, from before the rule in
 * eslint.config.js ("Only services touch the database"). The rule skips them.
 *
 * Shrink only: when a file is moved onto a service, delete its line here. Never
 * add one; new code calls a service instead. The work is done when this list
 * is empty, and then this file and its import go away.
 */
export default [
	'src/routes/o/[org_slug]/s/universe/buckets/[slug]/lists/+page.server.ts',
	'src/routes/o/[org_slug]/s/universe/buckets/[slug]/lists/[id]/+page.server.ts',
	'src/routes/o/[org_slug]/s/universe/buckets/[slug]/lists/[id]/cut/+page.server.ts',
	'src/routes/o/[org_slug]/s/universe/buckets/[slug]/lists/[id]/cut/survey/+page.server.ts',
	'src/routes/o/[org_slug]/s/universe/buckets/[slug]/lists/[id]/map/+page.server.ts',
	'src/routes/o/[org_slug]/s/universe/buckets/[slug]/locations/+page.server.ts'
];
