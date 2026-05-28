# Pre-Launch Checklist

A breakdown of features required before launch, organized by domain and broken into actionable tasks.

---

## 1. Overture Data Import

A map-based interface for selecting a geographic region and importing data from Overture Maps. Must be accessible to both infra admins and org admins, with deduplication to prevent redundant downloads.

- [ ] Research Overture Maps API — understand tile/region query format and data schema
- [ ] Design deduplication strategy (e.g. track downloaded regions or tile hashes in the database)
- [ ] Add schema for tracking import jobs and downloaded regions in `setup-schema.ts`
- [ ] Build map selection UI (region bounding box or polygon draw using MapLibre + Geoman)
- [ ] Build import API endpoint that queries Overture and inserts into the local database
- [ ] Wire deduplication check into the import endpoint
- [ ] Expose the import page at `/infra/data/overture` for infra admins
- [ ] Expose the import page at `/o/[org_slug]/s/data/overture` for org admins
- [ ] Add stories and tests for the map selection component
- [ ] Add stories and tests for the import status/result display component

---

## 2. Stripe Donations

A plugin that enables organizations to collect donations via Stripe. Must be globally toggle-able by infra admins.

- [ ] Add `stripe_enabled` flag to infra settings schema and infra settings UI
- [ ] Create plugin scaffold at `src/plugins/stripe-donations/index.ts` with a `PluginManifest`
- [ ] Store Stripe publishable key and secret key in org plugin config (encrypted at rest)
- [ ] Build staff settings page for configuring Stripe keys and donation options
- [ ] Build volunteer-facing donation form (Stripe Elements or Payment Link)
- [ ] Handle Stripe webhook for payment confirmation
- [ ] Gate plugin installation on `stripe_enabled` infra flag — hide from org plugin list when disabled
- [ ] Register plugin in `src/plugins/registry.ts`
- [ ] Add stories and tests for the donation form component
- [ ] Add stories and tests for the staff settings page component

---

## 3. Infra Settings: Telemetry

Allow infra admins to disable OpenTelemetry/Jaeger telemetry without requiring a code change.

- [ ] Add `telemetry_enabled` flag to infra settings schema and `setup-schema.ts`
- [ ] Read `telemetry_enabled` at server startup and conditionally initialize the OTel SDK
- [ ] Add toggle to the infra settings UI (`/infra/settings`)
- [ ] Document the setting in the relevant settings component story

---

## 4. Mailing List Opt-In

Users should be able to opt in or out of the mailing list at signup and in their personal profile settings.

- [ ] Add `mailing_list_opted_in` column to the `auth.user` table (or a profile extension table)
- [ ] Add opt-in checkbox to the signup flow
- [ ] Add opt-in toggle to personal profile settings (see section 5)
- [ ] Expose a read endpoint or export for infra admins to retrieve opted-in emails
- [ ] Add stories and tests for the signup checkbox
- [ ] Add stories and tests for the profile settings toggle

---

## 5. Personal Profile Settings

Users need a page to view and update their own profile information.

- [ ] Add profile settings route at `/o/[org_slug]/s/settings/profile` (or a global `/settings/profile`)
- [ ] Build page component in `src/stories/pages/settings/ProfileSettingsPage.svelte`
- [ ] Support updating display name and email
- [ ] Support the mailing list opt-in toggle (from section 4)
- [ ] Wire to an API endpoint that updates the `auth.user` record
- [ ] Add stories and tests for the profile settings page component

---

## 6. Password Reset

Users need a self-service way to reset their password.

- [ ] Confirm better-auth password reset flow is configured (email token delivery)
- [ ] Add "Forgot password?" link to the sign-in page
- [ ] Add a "Change password" option in personal profile settings (section 5)
- [ ] Test the full reset flow end-to-end (request → email → reset form → sign in)

---

## 7. Data Lists (Versioned Snapshots)

Users need to create named, point-in-time snapshots of location/entity data to use as stable inputs for turf cutting and reporting.

- [ ] Define the `list` (snapshot) schema in `setup-schema.ts` — name, created_at, org_id, source query/filters
- [ ] Define the `list_item` join table linking a list to its constituent location rows
- [ ] Build API endpoints: create list, read list, delete list, list all lists
- [ ] Build the list management UI (create, name, view members, delete)
- [ ] Add stories and tests for list management components
- [ ] Retrofit the turf cutting system to accept a `list_id` as its data source instead of querying live data directly (see section 8)
- [ ] Add stories and tests for the list selection step in the turf cutting flow

---

## 8. Turf Cutting — Move into Bucket UI and Use Lists

Turf cutting should live inside the data bucket/universe UI and draw from a snapshot list rather than live data.

- [ ] Identify current turf cutting route and component locations
- [ ] Move the turf cutting entry point into the bucket/universe UI (remove standalone nav entry if applicable)
- [ ] Add a list selection step at the start of the turf cutting flow (requires section 7)
- [ ] Update the turf cutting algorithm to query from `list_item` for the selected list
- [ ] Verify that existing turfs are not broken by the data source change
- [ ] Update stories and tests to reflect the new flow

---

## 9. Surveys — Move into Buckets

Surveys should be organized under the bucket/universe UI alongside turfs.

- [ ] Identify current survey route locations under `/o/[org_slug]/s/`
- [ ] Move survey creation and management into the bucket/universe context
- [ ] Update navigation entries to reflect the new location
- [ ] Ensure survey responses remain correctly scoped to org and, where applicable, to a specific list
- [ ] Update stories and tests for the new survey placement

---

## 10. Permissions System Hardening

The permissions system needs complete coverage of all resources and actions, and should be easy to apply to new pages.

- [ ] Audit all staff routes — list every page and the permission it should require
- [ ] Add any missing resource/action pairs to the `can()` helper and database schema
- [ ] Create a helper or convention for declaring the required permission at the top of each `+page.server.ts` (reduce boilerplate)
- [ ] Apply the permission check to every staff page that is currently unguarded
- [ ] Write tests for the permission resolution logic covering edge cases (owner bypass, role inheritance, missing role)
- [ ] Document the full permission matrix in this checklist or a dedicated doc

---

## 11. Entity List Builder UI

A beginner-friendly interface for org admins to generate filtered lists of users, businesses, or other entities and save them as snapshots (section 7).

- [ ] Identify all entity types that need to be listable (persons, businesses, locations, etc.)
- [ ] Design a filter/query builder component — simple field + operator + value rows, no SQL exposed
- [ ] Build a preview panel showing a sample of matching records
- [ ] Wire the "Save as List" action to the list creation API (section 7)
- [ ] Add stories and tests for the filter builder component
- [ ] Add stories and tests for the preview panel component

---

## 12. Reporting UI

A clean, beginner-friendly interface for generating and visualizing canvassing reports.

### 12a. Data Selection
- [ ] Design a report scope selector — choose date range, turf, survey, and/or list
- [ ] Build the scope selector component with sensible defaults
- [ ] Wire scope selector to a report data API endpoint that returns structured results
- [ ] Add stories and tests for the scope selector component

### 12b. Data Display
- [ ] Build a tabular results view with sorting and basic filtering
- [ ] Add CSV/XLSX export action for the selected data
- [ ] Add stories and tests for the results table component

### 12c. Charts and Graphs
- [ ] Select a charting library compatible with SvelteKit 5 (e.g. Chart.js via svelte-chartjs, or Recharts)
- [ ] Build a chart type picker (bar, line, pie) that adapts to the selected data shape
- [ ] Build individual chart components for each chart type
- [ ] Add a "share / export image" action for charts
- [ ] Add stories and tests for each chart component

---

## Cross-Cutting

Tasks that apply across multiple features above.

- [ ] Review and update the permissions matrix after sections 8, 9, and 10 are complete
- [ ] Run a full end-to-end test pass across the volunteer and staff flows before release
- [ ] Confirm all new database schema additions are present in `setup-schema.ts` (no migration files)
- [ ] Confirm all new components have stories and at least one passing test
- [ ] Review infra settings page for completeness — telemetry, Stripe toggle, and any other global flags added during this work
