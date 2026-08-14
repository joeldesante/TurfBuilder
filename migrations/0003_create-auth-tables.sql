-- Up Migration
-- Mirrors SETUP_STEPS step 3: "Creating auth tables"
--
-- These tables are owned by better-auth. Column shapes must stay in sync with
-- what better-auth expects; do not reshape them without checking the adapter.

CREATE TABLE IF NOT EXISTS auth.user (
	id            UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	name          TEXT NOT NULL,
	username      TEXT NOT NULL,
	display_username TEXT NOT NULL,
	email         TEXT NOT NULL,
	email_verified BOOLEAN NOT NULL,
	image         TEXT,
	two_factor_enabled BOOLEAN,
	role          TEXT,
	banned        BOOLEAN,
	ban_reason    TEXT,
	ban_expires   TIMESTAMP,
	impersonated_by UUID REFERENCES auth.user(id) ON DELETE SET NULL ON UPDATE CASCADE,
	created_at    TIMESTAMP NOT NULL DEFAULT now(),
	updated_at    TIMESTAMP NOT NULL DEFAULT now()
);

DO $$ BEGIN
	ALTER TABLE auth.user ADD CONSTRAINT user_username_unique UNIQUE (username);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
	ALTER TABLE auth.user ADD CONSTRAINT user_email_unique UNIQUE (email);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS auth.account (
	id                      UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	user_id                 UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
	account_id              TEXT NOT NULL,
	provider_id             TEXT NOT NULL,
	access_token            TEXT,
	refresh_token           TEXT,
	access_token_expires_at TIMESTAMP,
	refresh_token_expires_at TIMESTAMP,
	scope                   TEXT,
	id_token                TEXT,
	password                TEXT,
	created_at              TIMESTAMP NOT NULL DEFAULT now(),
	updated_at              TIMESTAMP NOT NULL DEFAULT now()
);

DO $$ BEGIN
	ALTER TABLE auth.account ADD CONSTRAINT account_provider_account_unique UNIQUE (provider_id, account_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS auth.verification (
	id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	identifier TEXT NOT NULL,
	value      TEXT NOT NULL,
	expires_at TIMESTAMP NOT NULL DEFAULT now(),
	created_at TIMESTAMP NOT NULL DEFAULT now(),
	updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.two_factor (
	id           UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	user_id      UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
	secret       TEXT,
	backup_codes TEXT
);

CREATE TABLE IF NOT EXISTS auth.organization (
	id         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	name       TEXT NOT NULL,
	slug       TEXT NOT NULL,
	logo       TEXT,
	metadata   TEXT,
	created_at TIMESTAMP NOT NULL DEFAULT now()
);

DO $$ BEGIN
	ALTER TABLE auth.organization ADD CONSTRAINT organization_slug_unique UNIQUE (slug);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS auth.session (
	id                     UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	user_id                UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
	token                  TEXT NOT NULL,
	ip_address             TEXT,
	user_agent             TEXT,
	active_organization_id UUID REFERENCES auth.organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
	expires_at             TIMESTAMP NOT NULL DEFAULT now(),
	created_at             TIMESTAMP NOT NULL DEFAULT now(),
	updated_at             TIMESTAMP NOT NULL DEFAULT now()
);

DO $$ BEGIN
	ALTER TABLE auth.session ADD CONSTRAINT session_token_unique UNIQUE (token);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS auth.invitation (
	id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	email           TEXT NOT NULL,
	inviter_id      UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
	organization_id UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
	role            TEXT,
	status          TEXT,
	created_at      TIMESTAMP NOT NULL DEFAULT now(),
	updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.member (
	id              UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	user_id         UUID NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE ON UPDATE CASCADE,
	organization_id UUID NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
	role            TEXT NOT NULL,
	created_at      TIMESTAMP NOT NULL DEFAULT now()
);

DO $$ BEGIN
	ALTER TABLE auth.member ADD CONSTRAINT member_user_org_unique UNIQUE (user_id, organization_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

-- Down Migration

DROP TABLE IF EXISTS auth.member CASCADE;
DROP TABLE IF EXISTS auth.invitation CASCADE;
DROP TABLE IF EXISTS auth.session CASCADE;
DROP TABLE IF EXISTS auth.organization CASCADE;
DROP TABLE IF EXISTS auth.two_factor CASCADE;
DROP TABLE IF EXISTS auth.verification CASCADE;
DROP TABLE IF EXISTS auth.account CASCADE;
DROP TABLE IF EXISTS auth.user CASCADE;
