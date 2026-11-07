/**
 * Files that still reach the database directly, from before the rule in
 * eslint.config.js ("Only services touch the database"). The rule skips them.
 *
 * Shrink only: when a file is moved onto a service, delete its line here. Never
 * add one; new code calls a service instead. The work is done when this list
 * is empty, and then this file and its import go away.
 */
export default [
	'src/routes/o/[org_slug]/map/[id]/+layout.server.ts',
	'src/routes/o/[org_slug]/map/[id]/+page.server.ts',
	'src/routes/o/[org_slug]/map/[id]/location/[location_id]/+page.server.ts',
	'src/routes/o/[org_slug]/map/[id]/location/[location_id]/+server.ts',
	'src/routes/o/[org_slug]/map/[id]/locations/+server.ts',
	'src/routes/o/[org_slug]/map/[id]/locations/[entity_id]/+server.ts',
	'src/routes/o/[org_slug]/map/[id]/locations/[location_id]/edits/+server.ts',
	'src/routes/o/[org_slug]/map/[id]/status/+server.ts',
	'src/routes/o/[org_slug]/s/api/search/+server.ts',
	'src/routes/o/[org_slug]/s/api/turf/create/+server.ts',
	'src/routes/o/[org_slug]/s/api/turfs/[id]/preview/+server.ts',
	'src/routes/o/[org_slug]/s/api/universe/lists/[id]/locations/+server.ts',
	'src/routes/o/[org_slug]/s/api/universe/lists/[id]/turfs/+server.ts',
	'src/routes/o/[org_slug]/s/api/universe/locations/+server.ts',
	'src/routes/o/[org_slug]/s/api/universe/locations/[entity_id]/+server.ts',
	'src/routes/o/[org_slug]/s/api/universe/locations/edits/[id]/approve/+server.ts',
	'src/routes/o/[org_slug]/s/api/universe/locations/edits/[id]/reject/+server.ts',
	'src/routes/o/[org_slug]/s/api/universe/locations/import/+server.ts',
	'src/routes/o/[org_slug]/s/api/universe/locations/import/overture/+server.ts',
	'src/routes/o/[org_slug]/s/api/universe/locations/suggestions/[id]/approve/+server.ts',
	'src/routes/o/[org_slug]/s/api/universe/locations/suggestions/[id]/reject/+server.ts',
	'src/routes/o/[org_slug]/s/api/universe/metrics/results/+server.ts',
	'src/routes/o/[org_slug]/s/api/universe/stats/+server.ts',
	'src/routes/o/[org_slug]/s/universe/buckets/[slug]/lists/+page.server.ts',
	'src/routes/o/[org_slug]/s/universe/buckets/[slug]/lists/[id]/+page.server.ts',
	'src/routes/o/[org_slug]/s/universe/buckets/[slug]/lists/[id]/cut/+page.server.ts',
	'src/routes/o/[org_slug]/s/universe/buckets/[slug]/lists/[id]/cut/survey/+page.server.ts',
	'src/routes/o/[org_slug]/s/universe/buckets/[slug]/lists/[id]/map/+page.server.ts',
	'src/routes/o/[org_slug]/s/universe/buckets/[slug]/lists/[id]/turfs/[turf_id]/+page.server.ts',
	'src/routes/o/[org_slug]/s/universe/buckets/[slug]/locations/+page.server.ts',
	'src/routes/o/[org_slug]/s/universe/buckets/[slug]/locations/[id]/+page.server.ts',
	'src/routes/o/[org_slug]/s/universe/data/locations/+page.server.ts',
	'src/routes/o/[org_slug]/s/universe/data/locations/suggestions/+page.server.ts',
	'src/routes/o/[org_slug]/s/universe/entity/[entity_id]/+page.server.ts'
];
