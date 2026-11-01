# Getting Started

## Prerequisites

TurfBuilder requires a Postgres database with PostGIS enabled. The easiest way to run everything locally is with Docker Compose, which handles the database automatically.

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) before continuing.

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/joeldesante/TurfBuilder.git
cd TurfBuilder
```

### 2. Set your environment variables

Copy `.env.example` to `.env`. The defaults work out of the box for local development with Docker Compose.

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Connection string for the PostgreSQL database. The default points to the Docker Compose Postgres container. |
| `BETTER_AUTH_SECRET` | Secret key used to encrypt session cookies and sensitive auth data. The example value is safe for local dev — **generate a new one for any shared or production environment**. Changing it invalidates all active sessions. |
| `SPACES_ACCESS_KEY_ID` | Access key for object storage (DigitalOcean Spaces or any S3-compatible service). Optional locally; needed for location photos and list PDFs. |
| `SPACES_SECRET_ACCESS_KEY` | Secret key paired with `SPACES_ACCESS_KEY_ID`. |

### 3. Start the application

```bash
docker compose up --build
```

This starts the Postgres database, the dev server, and supporting services (NATS, Jaeger). Until the next three steps are done, every page answers `503` with a message saying whether the database still needs migrating or the app still needs setting up.

### 4. Install the dependencies for the setup scripts

The migrate and setup scripts run on your machine and connect to the database container, which Docker Compose publishes on `localhost:5432`. They need Node 22 or newer.

```bash
npm install
```

### 5. Migrate the database

```bash
npm run migrate
```

This applies the migration files in `migrations/` to the database in `DATABASE_URL`, in order, one at a time. Running it again is safe: it only applies migrations the database does not have yet.

### 6. Set up the app

```bash
npm run setup
```

Setup checks that the database is migrated, then asks for each value it needs, one line at a time:

| Question | What to enter |
|----------|---------------|
| TurfBuilder URL | Where people open the app, e.g. `http://localhost:5173` |
| App name | Shown in the app and page titles. Press Enter to keep the default. |
| Admin name | The first admin's full name |
| Admin username | 3 to 30 letters, numbers, dots or underscores |
| Admin email | Used to sign in. It is marked as verified, so no email is sent. |
| Admin password | At least 8 characters. Each character shows as a dot. |

It saves the URL and name as system settings and creates the first admin with every infrastructure permission. Then sign in at `/auth/signin`.

Setup is safe to run again. It keeps the saved settings as the defaults, and once a user exists it does not create another admin.

To skip the questions, pass the values as flags. The password is never a flag; send it on standard input:

```bash
echo "$ADMIN_PASSWORD" | npm run setup -- --no-input --password-stdin \
  --base-url http://localhost:5173 --admin-name "Ada Lovelace" \
  --admin-username ada --admin-email ada@example.org
```

| Flag | Description |
|------|-------------|
| `--base-url` | Public address of the app |
| `--app-name` | Application name (default `TurfBuilder`) |
| `--admin-name`, `--admin-username`, `--admin-email` | The first admin |
| `--password-stdin` | Read the admin's password from standard input |
| `--mail-transport`, `--mail-domain`, `--ses-region` | Optional mail settings (`direct` or `ses`). Left as they are when not given. |
| `--no-input` | Never ask questions; fail and list what is missing |
| `--debug` | Show the full error when something fails |

Run `npm run setup -- --help` for the same list. Exit code 0 means setup finished, 1 means it failed, and 2 means a flag or value was invalid.

### 7. Set up object storage (optional)

Location photos and printable list PDFs are stored in object storage. To use them locally:

1. Create a bucket in DigitalOcean Spaces (or any S3-compatible service) and an access key for it.
2. Put the key in `.env` as `SPACES_ACCESS_KEY_ID` and `SPACES_SECRET_ACCESS_KEY`, then restart the containers.
3. Open `/infra/settings` and fill in **Spaces Endpoint** (e.g. `https://nyc3.digitaloceanspaces.com`), **Spaces Region** (e.g. `nyc3`, defaults to `us-east-1`), and **Spaces Bucket**.

Without storage, everything else works; photo uploads and PDF generation show a message that storage has not been set up.

PDF generation also needs Chromium. The Docker images install it; if you run the dev server outside Docker, Puppeteer downloads its own copy during `npm install`. See the [List PDFs guide](./guides/list-documents.md) for details.

### 8. Done

The application is available at [http://localhost:5173](http://localhost:5173).

## Staging and production

You do not run `npm run migrate` by hand on a deployed environment. The deploy workflow (`.github/workflows/deploy.yml`) runs the migrations in a Kubernetes Job before each rollout, so a failed migration stops the deploy and the old pods keep serving.

A new environment still needs `npm run setup` once, to save its URL and create the first admin. The production image does not include the scripts, so run it from a checkout of the repository on a machine that can reach the database:

```bash
DATABASE_URL="postgres://..." npm run setup -- --base-url https://turf.example.org
```

It asks for the admin details and the password. Use the flags and `--password-stdin` above for a scripted install.

## When the app says it is not ready

If the database cannot serve the app, every page answers `503` with a short page and one of these codes, instead of a setup form:

| Code | Meaning | What to do |
|------|---------|------------|
| `APP_NOT_MIGRATED` | The database answers but has no schema | Run `npm run migrate` |
| `APP_NOT_SET_UP` | The schema exists but `base_url` or `application_name` is missing | Run `npm run setup` |
| `DATABASE_UNREACHABLE` | The app could not connect | Check that the database is running and `DATABASE_URL` is correct |

The codes and their messages live in `src/lib/shared/registries/error-codes.ts`. The cause is also logged, with the same code.

## Changing the database schema

A schema change is a new SQL file in `migrations/`:

```bash
npm run migrate:create add_something
```

Fill in the `-- Up Migration` section, then run `npm run migrate`. Never edit or rename a migration that has been merged, because environments record applied files by name. Each file runs in its own transaction, and an environment that is behind is brought up to date by the next deploy.

## Key URLs

| URL | Description |
|-----|-------------|
| `http://localhost:5173` | Application |
| `/auth/signin` | Sign in |
| `/auth/signup` | Sign up |
| `http://localhost:16686` | Jaeger tracing UI |
