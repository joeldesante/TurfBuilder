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

This starts the Postgres database, the dev server, and supporting services (NATS, Jaeger).

### 4. Initialize the database

Once the application is running, open [http://localhost:5173/setup](http://localhost:5173/setup) in your browser. This page creates all required database tables automatically.

### 5. Set up object storage (optional)

Location photos and printable list PDFs are stored in object storage. To use them locally:

1. Create a bucket in DigitalOcean Spaces (or any S3-compatible service) and an access key for it.
2. Put the key in `.env` as `SPACES_ACCESS_KEY_ID` and `SPACES_SECRET_ACCESS_KEY`, then restart the containers.
3. Open `/infra/settings` and fill in **Spaces Endpoint** (e.g. `https://nyc3.digitaloceanspaces.com`), **Spaces Region** (e.g. `nyc3`, defaults to `us-east-1`), and **Spaces Bucket**.

Without storage, everything else works; photo uploads and PDF generation show a message that storage has not been set up.

PDF generation also needs Chromium. The Docker images install it; if you run the dev server outside Docker, Puppeteer downloads its own copy during `npm install`. See the [List PDFs guide](./guides/list-documents.md) for details.

### 6. Done

The application is available at [http://localhost:5173](http://localhost:5173).

## Key URLs

| URL | Description |
|-----|-------------|
| `http://localhost:5173` | Application |
| `/auth/signin` | Sign in |
| `/auth/signup` | Sign up |
| `/setup` | Database initialization |
| `http://localhost:16686` | Jaeger tracing UI |
