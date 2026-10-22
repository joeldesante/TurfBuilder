# Infrastructure panel

The panel at `/infra` is for the people who run the instance. Only users with infrastructure permissions see it. Everything else in the app is for organizers and volunteers.

## Getting around

- **Sidebar:** every page below, grouped. Entries you lack permission for are hidden.
- **Quick menu:** admins also get a round button in the bottom-left corner of every other page (or press Alt+I). It lists the infra pages, jumps to the current organization's infra page, and links to external tools. It is rendered only for admins; other users receive no markup and no infra URLs.
- **External tools:** analytics (Umami), tracing (Jaeger), and any custom links appear in the sidebar and quick menu. They are set under Settings, External tools. An empty address hides the link.

## Permissions

| Key | Lets an admin |
|---|---|
| `access` | Open the panel, read metrics, organizations, users, and system health |
| `users.manage` | Edit, suspend, and delete users; send resets; manage admins |
| `users.impersonate` | Sign in as another user |
| `orgs.manage` | Suspend, delete, restore, and transfer organizations; remove members |
| `settings.manage` | Change settings and email templates, read the email log, run migrations |
| `audit.read` | Read the audit log |
| `locations.overture_sync` | Run the Overture data sync |

The setup admin's role holds all of them, including ones added later (a migration grants new keys to the "Infrastructure Administrator" role).

## Pages

| Page | What it is for |
|---|---|
| Overview | Headline figures, growth, what needs attention, recent changes |
| Metrics | Every platform chart, with a range and granularity in the URL and a CSV download on each |
| Organizations | Every organization; the detail page shows who runs it, how active it is, members, invitations, activity, and audit |
| Users | Every account; the detail page shows organizations, sessions, activity, emails, and audit |
| Admins | Who holds infrastructure roles, and granting or removing them |
| Audit log | Every change an admin made |
| Settings | Site-wide settings in tabs, generated from the settings registry |
| Email templates | Edit each email with a live preview; reset to the shipped text |
| Email log | Every email the app tried to send |
| System health | Versions, database size and pool, and whether mail, storage, Chromium, and migrations are set up |
| Migrate | Runs the schema and data steps |

## Actions and safeguards

- Every change is written to the audit log with who, what, when, IP, and user agent.
- **Users:** suspend (signs them out and blocks sign-in), revoke sessions, impersonate, edit, verify, reset two-factor, send a reset or verification email, and delete. Deleting anonymizes the account rather than removing the row, because turfs and visits reference the user and must stay with their organization.
- **Organizations:** suspend (members see a suspended page), transfer ownership, remove members, cancel invitations and links, and soft-delete with a restore. Deleting needs the slug typed back.
- **Last admin:** the panel refuses to remove the last admin who has `access` and `users.manage`.
- **Impersonation:** lasts one hour, shows a banner, blocks `/infra` while active, and audits every change made.

## Activity data

Charts read from `activity_event` and `user_activity_day`, written as things happen (sign-ups, sign-ins, visits, surveys, lists, turfs, documents). Migrating backfills history from timestamps already in the database, and is safe to rerun. Events older than `activity.retention_days` (default 730; 0 keeps everything) are removed when migrations run.

## Operating notes

- `base_url` is read when auth starts. Saving it rebuilds auth on the pod that handled the request; restart the others (`kubectl rollout restart deployment/turfbuilder-production -n turfbuilder`).
- Set `GIT_SHA` at build or deploy time to show the running commit on System health.
- Jaeger has no sign-in of its own. If you link it, keep it behind access control.
- All panel endpoints live under `/api/v1`; see `src/routes/api/v1/README.md` for the tables.
