# Functions

DigitalOcean Functions that run outside the app. Each function sits in
`packages/<package>/<function>/` and is listed in `project.yml`.

## imports/import-contacts

Reads an uploaded contacts CSV from Spaces (the `universe.contact_import_file`
row names the file) and writes its rows into the database. Called with
`{ "orgId": "...", "jobId": "..." }`, where the job is a `universe.contact_import_job` row the app creates first. Node.js 20, plain JavaScript, because
DigitalOcean installs the dependencies and runs the file as it is, with no build step.

Progress: every batch is its own transaction and updates `rows_processed` on the job row, so the browser can poll the row (`rows_processed / rows_total`). After each batch the function rests for the time the batch took times `IMPORT_PACE_RATIO`, so the database is not driven flat out. A failed or timed-out job can be called again and skips the rows already written.

`importBatch` is a stub. It needs the column mapping from the contact schema.

## Run locally

No upload needed. `run-local.js` calls the function the way DigitalOcean does, with the env
vars from `.env`. Point `DATABASE_URL` at the local Postgres and the Spaces values at a
local S3 stand-in (the `s3mock` in `docker-compose.test.yml`).

```bash
(cd packages/imports/import-contacts && npm install)
node --env-file=.env run-local.js import-contacts '{"orgId":"<org id>","jobId":"<job id>"}'
```

### Local invoke API

The app's server should call the function through the invoke API, not by importing it. For dev,
`npm run dev` starts a stand-in for that API, so the app calls the same URL shape locally and
in production:

```bash
# in .env: FUNCTIONS_LOCAL_KEY=<any secret>
npm run dev     # http://localhost:3233
curl -X POST -H "Authorization: Basic $(printf '<key>' | base64)" \
  http://localhost:3233/api/v1/namespaces/_/actions/imports/import-contacts \
  -d '{"orgId":"<org id>","jobId":"<job id>"}'
```

It answers 202 with an `activationId` and runs in the background, as DigitalOcean does by
default. Add `?blocking=true` to wait for the result. Requests without the key get 401.
The function is reloaded on every call, so edits apply without a restart.

Watch progress from another terminal:

```sql
SELECT status, rows_processed, rows_total, updated_at FROM universe.contact_import_job;
```

This does not enforce DigitalOcean's time or memory limits, so a deployed run can still
time out where a local one does not.

## Deploy

```bash
cp .env.example .env   # fill in the values
doctl serverless install
doctl serverless connect
doctl serverless deploy .
```
