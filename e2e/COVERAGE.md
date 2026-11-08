# E2E coverage sheet (temporary working file)

Working file for TB-237 part 2. It keeps the e2e work on track across sessions and is
deleted once every row has its test (plan step 4). Do not link to it from docs.

Status: `todo`, `covered`, `bug` (found a bug, see note), `removed` (feature removed),
`v1-only` (the API test calls a /api/v1 route added in A to D, so it does not run against df7d48b).

Personas: `anon` signed out, `outsider` member of another org only, `vol` volunteer
(member, no staff role, canvass.use), `staff-` staff without the key, `staff+` staff with
the key, `owner`, `infra` infra admin, `imp` admin impersonating a user.

Spec files are `e2e/<area>.spec.ts`; API-only checks are in `e2e/api/<area>.spec.ts`.

## Global and cross-cutting (GLB)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| GLB-01 | `/` sends a signed-out visitor to sign in and a signed-in one to the org picker | anon, any | `/` | global | | covered |
| GLB-02 | Legal pages `/privacy` and `/terms` render for anyone | anon | `/privacy`, `/terms` | global | | covered |
| GLB-03 | `robots.txt` is served | anon | `/robots.txt` | global | | covered |
| GLB-04 | Unknown org slug answers 404 / sends to `/orgs` | any | `/o/nope` | global | | covered |
| GLB-05 | Org home shows the org name and a Begin Canvassing link to join | vol | `/o/[slug]` | global | | covered |
| GLB-06 | A non-member of an org cannot open its pages | outsider | `/o/[slug]/**` | global | | covered |
| GLB-07 | A suspended org answers 403 to members, opens for infra admins | vol, infra | `/o/[slug]` | global | hooks.server.spec | covered (a suspended org grants no permissions, so infra admins pass the hook but not staff pages, by design) |
| GLB-08 | A deleted org is treated as missing | vol | `/o/[slug]` | global | hooks.server.spec | covered |
| GLB-09 | A user with a fake email is sent to update it before anything else | user | any | auth-flows | hooks.server.spec | covered |
| GLB-10 | No analytics requests leave the browser when analytics are off | any | any page | global | analytics.spec | covered |
| GLB-11 | Toasts show for errors and confirmations | staff | e.g. members | covered by area specs | | todo |
| GLB-12 | The beta banner shows on staff pages and stays dismissed | staff | `/o/[slug]/s` | global | | covered |
| GLB-13 | Infra quick menu shows on non-infra pages for infra admins only | infra, staff | any | infra | | covered (infra.spec) |
| GLB-14 | Uploads: presign then fetch an uploaded photo; another org's key is refused | staff, outsider | `/o/[slug]/uploads/**` | uploads | | todo |
| GLB-15 | Maintenance mode answers 503 everywhere before the database | anon | env flag | unit only | maintenance.spec, hooks.server.spec | covered |
| GLB-16 | Not-ready database answers 503 pages | anon | | unit only | hooks.server.spec | covered |

## Auth (AUTH)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| AUTH-01 | Sign in with the setup admin | admin | `/auth/signin` | auth | | covered |
| AUTH-02 | Wrong password shows an error and stays signed out | anon | `/auth/signin` | auth-flows | | covered |
| AUTH-03 | Sign up creates an account and sends a verification email | anon | `/auth/signup` | auth-flows | | covered |
| AUTH-04 | Following the verification link verifies the email | user | mail link | auth-flows | | covered |
| AUTH-05 | Unverified users are sent to verify-email before staff pages | user | `/o/[slug]/s` | auth-flows | | covered |
| AUTH-06 | Verify-email page can resend and go back | user | `/auth/verify-email` | auth-flows | | covered |
| AUTH-07 | Forgot password sends a reset email | anon | `/auth/forgot-password` | auth-flows | | covered |
| AUTH-08 | Reset link sets a new password; old one stops working | anon | `/auth/reset-password` | auth-flows | | covered |
| AUTH-09 | Sign out ends the session | user | account menu | auth-flows | | covered |
| AUTH-10 | 2FA setup: scan, verify a TOTP code, backup codes | user | `/auth/2fa/setup` | auth-flows | | covered (bug fixed, two_factor lacked the verified column better-auth 1.6 writes; migration 20261107232724817) |
| AUTH-11 | Sign in with 2FA asks for a code; a wrong code is refused | user | `/auth/signin` | auth-flows | | covered (bug fixed, sign-in had no code step so 2FA users were locked out; also fixed a lost click when an error clears on focusout) |
| AUTH-12 | Update email for fake-email accounts | user | `/auth/update-email` | auth-flows | | covered (bug fixed, change-email was disabled and the hook redirected /api/auth for placeholder accounts; now enabled for placeholder accounts only) |
| AUTH-13 | Signing in again while signed in (parked, #179) | user | | auth | | covered (fixme) |
| AUTH-14 | Sign-in redirectTo returns to the page asked for | anon | `?redirectTo=` | auth-flows | | covered |

## Orgs (ORG)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| ORG-01 | Org picker lists the user's orgs and opens one | user | `/orgs` | orgs | | covered |
| ORG-02 | Org picker offers create only when creation is allowed | user | `/orgs` | orgs | orgs page.server.spec | covered |
| ORG-03 | Create org checks the slug as you type and creates it; you are owner | user | `/orgs/create` | orgs | | covered |
| ORG-04 | Taken slug is refused | user | `/orgs/create` | orgs | | covered |
| ORG-05 | Create is closed when disabled (page redirects, API 403) | user | `/orgs/create` | orgs | organizations.service.spec | covered |
| ORG-06 | Join org page explains how to join | user | `/orgs/join` | orgs | | covered |
| ORG-07 | A new org gets default roles and onboarding | owner | new org | orgs | | covered (onboarding is the org picker welcome) |
| ORG-08 | Org API: get, replace, update name and slug | owner | `/api/v1/organizations/[id]` | orgs | | covered |

## Invites (INV)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| INV-01 | Staff creates an invite link with no expiry | staff+ | members page | invites | | covered |
| INV-02 | Staff creates an invite link with an expiry date | staff+ | members page | invites | | covered (bug fixed, expiry was a zoneless timestamp, shown a day early and ending at the start of the day; migration 20261108001510908) |
| INV-03 | Staff revokes a link; it stops working | staff+ | members page | invites | | covered |
| INV-04 | Toggling the slug invite on lets anyone join at `/invite/[slug]`; off stops it | staff+ | members page | invites | | covered (bug fixed, the Switch had no accessible name without an id) |
| INV-05 | Invite page shows the org and asks a signed-out visitor to sign in | anon | `/invite/[token]` | invites | | covered |
| INV-06 | Joining through a link adds a plain member and lands in the org | user | `/invite/[token]` | invites | invite-links.service.spec | covered |
| INV-07 | Already a member: page says so, joining changes nothing | vol | `/invite/[token]` | invites | | covered |
| INV-08 | Expired or unknown token answers 404 | user | `/invite/x` | invites | | covered |
| INV-09 | Without member.invite the invite section is hidden and the API answers 403 | staff- | members, API | invites | | covered |
| INV-10 | Email invitations: infra cancels a pending invitation | infra | infra org page | infra-orgs | | todo |

## Members (MEM)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| MEM-01 | Members page lists members with role and paging | staff+ | `/o/[slug]/s/members` | members | members.service.spec | covered |
| MEM-02 | Without member.read the page answers 403 | staff- | | members | | covered |
| MEM-03 | Assigning a role changes the member's role | staff+ | members page | members | | covered |
| MEM-04 | Demoting the last administrator is refused with a message | staff+ | members page | members | | covered (bug fixed, refusals were never shown and the role picker kept the refused choice) |
| MEM-05 | Removing a member removes their access | staff+ | members page | members | | covered |
| MEM-06 | Removing yourself is refused | staff+ | API | members | | covered |
| MEM-07 | Removing the only owner is refused | staff+ | API | members | | covered |
| MEM-08 | Member detail lists permissions with overrides | staff+ | `/members/[user_id]` | members | | covered (bug fixed, permission badges were named only Inherited/Granted/Denied) |
| MEM-09 | Granting and denying a permission override takes effect; clearing restores the role's | staff+ | member detail | members | | covered |
| MEM-10 | Without member.update the controls are hidden and the API answers 403 | staff- | | members | | covered |
| MEM-11 | Member and permission ids from another org answer 404 | outsider | API | members | | v1-only |

## Roles (ROLE)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| ROLE-01 | Roles page lists roles with permission counts | staff+ | `/s/settings/roles` | roles | | covered |
| ROLE-02 | Without role.read the roles pages answer 403 | staff- | | roles | | covered |
| ROLE-03 | Creating a role adds it | staff+ | roles page | roles | | covered (no UI since 8bccb6a, API only) |
| ROLE-04 | Renaming a role | staff+ | role detail | roles | | covered |
| ROLE-05 | Saving a role's permissions changes what its members can do | staff+ | role detail | roles | | covered (bug fixed, permission switches had no accessible names and save failures were silent) |
| ROLE-06 | The administrator role keeps system.access | staff+ | role detail | roles | roles.service.spec | covered |
| ROLE-07 | The default role cannot be renamed or deleted | staff+ | | roles | roles.service.spec | covered |
| ROLE-08 | Deleting a role | staff+ | roles page | roles | | covered |
| ROLE-09 | A role from another org answers 404 | outsider | API, page | roles | | v1-only |

## Plugins (PLG)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| PLG-01 | Add-ons page lists plugins with install state | staff+ (plugin.manage) | `/s/addons`, `/s/plugins` | plugins | | todo |
| PLG-02 | Installing a plugin adds its nav entries and pages | staff+ | add-ons | plugins | | todo |
| PLG-03 | Uninstalling removes them, reinstalling keeps config | staff+ | add-ons | plugins | | todo |
| PLG-04 | Without plugin.manage the page answers 403 | staff- | | plugins | | todo |
| PLG-05 | Staff plugin page renders | staff | `/s/plugins/[slug]/...` | plugins | | todo |
| PLG-06 | Volunteer plugin page renders | vol | `/o/[slug]/plugins/[slug]/...` | plugins | | todo |
| PLG-07 | Plugin config is validated and saved | staff+ | API | api/plugins | plugin-installations.service.spec | v1-only |
| PLG-08 | Plugin API handler runs for staff, 403 for non-staff, 404 when inactive | staff, vol | API | api/plugins | | v1-only |
| PLG-09 | Plugin hooks fire on turf creation and survey submission | staff, vol | | plugins | hooks.spec | todo |

## Buckets (BKT)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| BKT-01 | Creating a bucket adds it to the sidebar | staff | `/universe/buckets/new` | buckets | | covered |
| BKT-02 | Duplicate bucket slug is refused | staff | | buckets | | covered |
| BKT-03 | Bucket overview shows its counts | staff | `/buckets/[slug]` | buckets | | covered (a bucket opens on its locations page) |
| BKT-04 | Filter editor saves people and location filter groups; counts change | staff | `/buckets/[slug]/filters` | buckets | filters.service.spec | covered |
| BKT-05 | Each location filter field works: city, state, zip, radius, boundary, name | staff | filter editor | buckets | filters.service.spec | covered (every location filter and operation through the bucket API) |
| BKT-06 | Each people filter field works | staff | filter editor | buckets | filters.service.spec | covered (every people filter through the bucket API) |
| BKT-07 | A bucket with an old filter that cannot be converted shows the reason; filters page can rebuild it | staff | | buckets | buckets.service.spec | covered |
| BKT-08 | Bucket locations list and paging | staff | `/buckets/[slug]/locations` | buckets | | covered |
| BKT-09 | Bucket location detail | staff | `/buckets/[slug]/locations/[id]` | buckets | | covered |
| BKT-10 | Bucket people list and paging; disabled when the bucket has no people | staff | `/buckets/[slug]/people` | buckets | | covered |
| BKT-11 | Bucket person profile | staff | `/buckets/[slug]/people/[id]` | buckets | | covered |
| BKT-12 | Unknown bucket slug answers 404 | staff | | buckets | | covered |
| BKT-13 | Bucket API: get, replace, update; another org's bucket 404 | staff, outsider | API | buckets | | covered |

## Universe data (DATA)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| DATA-01 | People list with paging | staff | `/universe/data/people` | data | people.service.spec | todo |
| DATA-02 | Person profile | staff | `/universe/people/[id]` | data | | todo |
| DATA-03 | People CSV import adds valid rows and reports invalid ones | staff | `/universe/manage` | data | people.service.spec | todo |
| DATA-04 | Non-CSV people upload is refused | staff | manage | data | | todo |
| DATA-05 | Locations browser shows locations on the map and list for the viewport | staff | `/universe/data/locations` | locations | | todo |
| DATA-06 | Creating a location by dropping a pin | staff (location.create) | locations browser | locations | | todo |
| DATA-07 | Editing a location creates a new version; lists made earlier do not change | staff (location.update) | locations browser | locations | locations.service.spec | todo |
| DATA-08 | Moving a location's pin | staff | locations browser | locations | | todo |
| DATA-09 | Deleting a location | staff (location.delete) | locations browser | locations | | todo |
| DATA-10 | Location photos upload and show | staff | locations browser | locations | | todo |
| DATA-11 | Locations CSV import from the manage page and the import page | staff | manage, `/import/csv` | locations | | todo |
| DATA-12 | Google Sheets import option | staff | `/import/[source]` | locations | | todo |
| DATA-13 | Overture import | staff | `/import/overture` | | | removed (step 5) |
| DATA-14 | Suggestions page lists new-door suggestions and edit proposals | staff | `/data/locations/suggestions` | suggestions | | todo |
| DATA-15 | Approving a suggestion creates the location | staff | suggestions | suggestions | suggestions.service.spec | todo |
| DATA-16 | Rejecting a suggestion | staff | suggestions | suggestions | | todo |
| DATA-17 | Approving an edit proposal applies it as a new version | staff | suggestions | suggestions | | todo |
| DATA-18 | Rejecting an edit proposal | staff | suggestions | suggestions | | todo |
| DATA-19 | Entity page shows a location's or person's versions | staff | `/universe/entity/[id]` | data | | todo |
| DATA-20 | Integrations page lists integrations | staff | `/data/integrations` | integrations | integrations.service.spec | todo |
| DATA-21 | Toggling an integration needs infra settings.manage (staff 403, infra ok) | staff, infra | integrations | integrations | integrations.service.spec | todo |
| DATA-22 | Integration detail page | staff | `/data/integrations/[id]` | integrations | | todo |
| DATA-23 | Data sources page renders | staff | `/data/sources` | data | | todo |
| DATA-24 | Without location.* keys the location controls are refused | staff- | | locations | | todo |
| DATA-25 | Org people and locations API pages; other org 404 | staff, outsider | API | api/data | | todo |

## Search (SRCH)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| SRCH-01 | Search box finds people and locations by name and address | staff | header search | search | | todo |
| SRCH-02 | Universe search page builds queries and shows results | staff | `/universe/search` | search | query-builder.service.spec | todo |
| SRCH-03 | Removing a query term | staff | search page | search | | todo |
| SRCH-04 | Search never returns another org's records | staff | | search | | todo |

## Lists (LIST)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| LIST-01 | Creating a list from a bucket snapshots its matches | staff | `/buckets/[slug]/lists/new` | lists | lists.service.spec | covered (creating returns to the lists page) |
| LIST-02 | Bucket lists page lists them | staff | `/buckets/[slug]/lists` | lists | | covered |
| LIST-03 | List detail shows entries with paging, tabs for entries and turfs | staff | `/lists/[id]` | lists | | covered |
| LIST-04 | List entries keep the versions from when the list was made after edits and deletes | staff | list detail | lists | | bug (known #188, repointToVersion moves entries to the new version; test.fail until step F) |
| LIST-05 | List map shows entries and turfs | staff | `/lists/[id]/map` | lists | | covered |
| LIST-06 | PDF generate, download, regenerate, delete | staff | list detail | list-documents | | covered |
| LIST-07 | Signed-out document API refuses | anon | API | list-documents | | covered |
| LIST-08 | Another org's list answers 404 | outsider | page, API | lists | | covered |
| LIST-09 | List entries API pages | staff | API | lists | | covered |

## Turfs (TURF)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| TURF-01 | Survey selection modal lists the bucket's surveys and scripts; none means create one first | staff | list detail | lists | | covered |
| TURF-02 | Cut page draws a turf and creates it with a code | staff | `/lists/[id]/cut` | lists | | covered |
| TURF-03 | Cut survey step creates turfs | staff | `/lists/[id]/cut/survey` | lists | | covered (the survey step is the modal before the cut map) |
| TURF-04 | A location can only be in one turf of a list | staff | cut page | lists | | covered (not a rule; overlapping turfs share doors, which the test pins down (review)) |
| TURF-05 | Turf preview modal shows its doors | staff | list detail | lists | | covered |
| TURF-06 | Turf detail page shows doors, code, progress | staff | `/lists/[id]/turfs/[turf_id]` | lists | | covered |
| TURF-07 | Turf creation fires the onTurfCreated hook | staff | | turfs | hooks.spec | todo |

## Surveys and scripts (SVY)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| SVY-01 | Creating a survey opens its editor | staff | `/buckets/[slug]/surveys/new` | surveys | | covered |
| SVY-02 | Surveys list, most recently changed first | staff | `/buckets/[slug]/surveys` | surveys | | covered |
| SVY-03 | Editing name and description saves | staff (survey.update) | survey editor | surveys | | covered |
| SVY-04 | Adding text, choose-one and choose-many questions with choices saves | staff | survey editor | surveys | surveys.service.spec | covered (bug fixed, question and choice inputs and their buttons had no accessible names) |
| SVY-05 | Reordering questions saves the order | staff | survey editor | surveys | | covered (the editor has no reordering; questions keep the order they are added in, which the test checks) |
| SVY-06 | Removing a question deletes it | staff | survey editor | surveys | | covered |
| SVY-07 | Without survey.update the editor answers 403 | staff- | | surveys | | covered |
| SVY-08 | A survey from another bucket's URL answers 404 | staff | | surveys | | covered |
| SVY-09 | Creating a script and editing its text saves | staff | `/buckets/[slug]/scripts/**` | surveys | scripts.service.spec | covered |
| SVY-10 | Scripts list | staff | `/buckets/[slug]/scripts` | surveys | | covered |
| SVY-11 | Survey and script API: another org's 404, delete survey 409 while a turf uses it | outsider, staff | API | surveys | surveys.service.spec | v1-only |

## Canvassing (CNV)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| CNV-01 | Joining a turf by its code opens its map | vol | `/o/[slug]/join` | canvass | turfs.service.spec | covered |
| CNV-02 | A wrong code shows a message | vol | join | canvass | | covered |
| CNV-03 | Turf map shows the turf's doors with their status | vol | `/o/[slug]/map/[id]` | canvass | | covered (bug fixed, door markers had no role, name, or keyboard access) |
| CNV-04 | Status refreshes as doors are visited | vol | map | canvass | | covered |
| CNV-05 | Opening a door shows the survey screen with the script | vol | `/map/[id]/location/[id]` | canvass | | covered |
| CNV-06 | Submitting each question type records the response and marks the door | vol | survey screen | canvass | | covered (bug fixed, text answers had no accessible name) |
| CNV-07 | Not home / no contact records an attempt without answers | vol | survey screen | canvass | | covered |
| CNV-08 | Suggesting a new door from the map | vol | map | canvass | | covered (bug fixed, turf bounds were saved with SRID 0 so adding a door to any turf failed with a 500; migration 20261108040950116) |
| CNV-09 | Editing and deleting your own suggestion | vol | map | canvass | | covered |
| CNV-10 | Proposing a fix to a door | vol | map | canvass | | covered |
| CNV-11 | A volunteer cannot open staff pages | vol | `/o/[slug]/s` | canvass | | covered |
| CNV-12 | A user not on the turf cannot open its map | vol | `/map/[id]` | canvass | | covered |
| CNV-13 | Survey submission fires onSurveySubmitted | vol | | canvass | hooks.spec | todo |

## Metrics and dashboard (MET)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| MET-01 | Metrics page: pick a bucket and survey, view results on the map | staff | `/universe/metrics` | metrics | | todo |
| MET-02 | Date range narrows the results | staff | metrics | metrics | | todo |
| MET-03 | Multiple result tabs: add, select, close, reorder | staff | metrics | metrics | | todo |
| MET-04 | Selecting a location shows its responses | staff | metrics | metrics | | todo |
| MET-05 | Dashboard shows progress and the map for the universe | staff | `/o/[slug]/s` | dashboard | dashboard.service.spec | todo |
| MET-06 | Dashboard bucket filter and range change the numbers | staff | dashboard | dashboard | | todo |
| MET-07 | Dashboard empty state for a new org | staff | dashboard | dashboard | | todo |
| MET-08 | Universe stats API | staff | API | api/stats | | todo |

## Infra (INF)

| Id | Behavior | Actors | Entry | Test | Unit | Status |
|---|---|---|---|---|---|---|
| INF-01 | Signed-out infra API answers 401, panel sends to sign in | anon | | infra | | covered |
| INF-02 | Non-admins get 403 on the panel and API | user | `/infra` | infra | | todo |
| INF-03 | Overview headline figures | infra | `/infra` | infra | | covered |
| INF-04 | Every panel page opens | infra | | infra | | covered |
| INF-05 | Metrics page charts and range | infra | `/infra/metrics` | infra | | todo |
| INF-06 | Orgs list and search | infra | `/infra/orgs` | infra-orgs | | todo |
| INF-07 | Suspend and unsuspend an org; members are locked out while suspended | infra | org detail | infra-orgs | | todo |
| INF-08 | Delete an org (confirm slug) and restore it | infra | org detail | infra-orgs | | todo |
| INF-09 | Transfer ownership | infra | org detail | infra-orgs | | todo |
| INF-10 | Remove a member from the org detail page | infra | org detail | infra-orgs | | todo |
| INF-11 | Revoke an invite link from the org detail page | infra | org detail | infra-orgs | | todo |
| INF-12 | Org activity and audit tabs | infra | org detail | infra-orgs | | todo |
| INF-13 | Users list and search, opening a user | infra | `/infra/users` | infra | | covered |
| INF-14 | Edit a user's details | infra | user detail | infra-users | | todo |
| INF-15 | Suspend and unsuspend a user; suspended users cannot sign in | infra | user detail | infra-users | | todo |
| INF-16 | Delete a user (confirm email) | infra | user detail | infra-users | | todo |
| INF-17 | Impersonate a user, see the banner, stop and return | infra, imp | user detail | infra-users | | todo |
| INF-18 | While impersonating, the infra panel is closed and changes are audited | imp | | infra-users | hooks.server.spec | todo |
| INF-19 | Revoke one session and all sessions | infra | user detail | infra-users | | todo |
| INF-20 | Send a password reset and a verification email | infra | user detail | infra-users | | todo |
| INF-21 | Reset a user's 2FA | infra | user detail | infra-users | | todo |
| INF-22 | User activity, audit, email, memberships tabs | infra | user detail | infra-users | | todo |
| INF-23 | Admins page: find a user, grant and revoke an infra role | infra (users.manage) | `/infra/admins` | infra-admins | | todo |
| INF-24 | Audit log lists changes and filters | infra (audit.read) | `/infra/audit` | infra | | todo |
| INF-25 | Settings change is audited | infra | `/infra/settings` | infra | | covered |
| INF-26 | Bad setting value shows on the field | infra | settings | infra | | covered |
| INF-27 | Storage test reports success against s3mock | infra | settings | infra | | todo |
| INF-28 | Mail test sends to the admin (Mailpit receives it) | infra | settings | infra-mail | | todo |
| INF-29 | Email templates list, edit, save, reset to default | infra | `/infra/settings/email/templates/**` | infra-mail | | todo |
| INF-30 | Email template test send arrives | infra | template editor | infra-mail | | todo |
| INF-31 | Email log lists sends | infra | `/infra/settings/email/log` | infra-mail | | todo |
| INF-32 | System health page reports database, storage and migrations | infra | `/infra/system` | infra | | todo |
| INF-33 | Each infra permission gates its pages and actions | infra-partial | | infra-admins | | todo |
| INF-34 | Organization creation setting closes create | infra, user | settings | orgs | | todo |
