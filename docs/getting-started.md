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

### 3. Start the application

```bash
docker compose up --build
```

This starts the Postgres database, the dev server, and supporting services (NATS, Jaeger).

### 4. Initialize the database

Once the application is running, open [http://localhost:5173/setup](http://localhost:5173/setup) in your browser. This page creates all required database tables automatically.

### 5. Done

The application is available at [http://localhost:5173](http://localhost:5173).

## Key URLs

| URL | Description |
|-----|-------------|
| `http://localhost:5173` | Application |
| `/auth/signin` | Sign in |
| `/auth/signup` | Sign up |
| `/setup` | Database initialization |
| `http://localhost:16686` | Jaeger tracing UI |
