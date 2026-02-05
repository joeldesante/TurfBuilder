import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';
import { PgLiteral } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions = {
    id: {
        type: 'uuid',
        notNull: true,
        primaryKey: true,
        default: new PgLiteral('gen_random_uuid()'), 
    },
    time_stamp: {
        type: 'timestamp',
        notNull: true,
        default: new PgLiteral('now()'),
    },
};

export async function up(pgm: MigrationBuilder): Promise<void> {
    pgm.createExtension([
        "postgis",
        "postgis_topology"
    ], { ifNotExists: true })

    pgm.createFunction("update_geometry", [], {
        returns: "trigger",
        language: "plpgsql",
        replace: true
    }, `
        BEGIN
            NEW.geom = ST_SetSRID(
                ST_MakePoint(NEW.longitude, NEW.latitude),
                4326
            );
            RETURN NEW;
        END;
    `)

    pgm.createSchema('auth', {
        ifNotExists: true
    })

    // Users
    pgm.createTable({ schema: 'auth', name: 'user' }, {
        id: 'id',
        name: { type: 'text', notNull: true },
        username: { type: 'text', notNull: true, unique: true },
        display_username: { type: 'text', notNull: true },
        email: { type: 'text', notNull: true, unique: true },
        email_verified: { type: 'boolean', notNull: true },
        image: "text",
        two_factor_enabled: 'boolean',
        role: 'text',
        banned: 'boolean',
        ban_reason: 'text',
        ban_expires: { type: 'timestamp' },
        impersonated_by: {
            type: 'uuid',
            references: { schema: 'auth', name: 'user' },
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        },
        created_at: "time_stamp",
        updated_at: "time_stamp"
    })

    // Account
    pgm.createTable({ schema: 'auth', name: 'account' }, {
        id: 'id',
        user_id: {
            type: 'uuid',
            notNull: true,
            references: { schema: 'auth', name: 'user' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        account_id: { type: 'text', notNull: true },
        provider_id: { type: 'text', notNull: true },
        access_token: 'text',
        refresh_token: 'text',
        access_token_expires_at: { type: 'timestamp' },
        refresh_token_expires_at: { type: 'timestamp' },
        scope: 'text',
        id_token: 'text',
        password: 'text',
        created_at: "time_stamp",
        updated_at: "time_stamp"
    })

    pgm.createConstraint({ schema: 'auth', name: 'account' }, 'account_provider_account_unique', {
        unique: ['provider_id', 'account_id']
    })

    // Verification
    pgm.createTable({ schema: 'auth', name: 'verification' }, {
        id: 'id',
        identifier: { type: 'text', notNull: true },
        value: { type: 'text', notNull: true },
        expires_at: 'time_stamp',
        created_at: "time_stamp",
        updated_at: "time_stamp"
    })

    // Two Factor
    pgm.createTable({ schema: 'auth', name: 'two_factor' }, {
        id: 'id',
        user_id: {
            type: 'uuid',
            notNull: true,
            references: { schema: 'auth', name: 'user' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        secret: 'text',
        backup_codes: 'text'
    });

    // Organization
    pgm.createTable({ schema: 'auth', name: 'organization' }, {
        id: 'id',
        name: { type: 'text', notNull: true },
        slug: { type: 'text', notNull: true, unique: true },
        logo: { type: 'text' },
        metadata: { type: 'text' },
        created_at: 'time_stamp'
    })

    // Session
    pgm.createTable({ schema: 'auth', name: 'session' }, {
        id: 'id',
        user_id: {
            type: 'uuid',
            notNull: true,
            references: { schema: 'auth', name: 'user' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        token: { type: 'text', notNull: true, unique: true },
        ip_address: "text",
        user_agent: "text",
        active_organization_id: {
            type: 'uuid',
            references: { schema: 'auth', name: 'organization' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        expires_at: 'time_stamp',
        created_at: "time_stamp",
        updated_at: "time_stamp"
    })

    // Invitation
    pgm.createTable({ schema: 'auth', name: 'invitation' }, {
        id: 'id',
        email: { type: 'text', notNull: true },
        inviter_id: {
            type: 'uuid',
            references: { schema: 'auth', name: 'user' },
            notNull: true,
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        organization_id: {
            type: 'uuid',
            references: { schema: 'auth', name: 'organization' },
            notNull: true,
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        role: { type: 'text' },
        status: { type: 'text' },
        created_at: 'time_stamp',
        updated_at: 'time_stamp'
    })

    // Member (of the org)
    pgm.createTable({ schema: 'auth', name: 'member' }, {
        id: 'id',
        user_id: {
            type: 'uuid',
            references: { schema: 'auth', name: 'user' },
            notNull: true,
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        organization_id: {
            type: 'uuid',
            references: { schema: 'auth', name: 'organization' },
            notNull: true,
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        role: { type: 'text', notNull: true },
        created_at: 'time_stamp'
    })

    pgm.createConstraint({ schema: 'auth', name: 'member' }, 'member_user_org_unique', {
        unique: ['user_id', 'organization_id']
    })

    // Surveys
    pgm.createTable('survey', {
        id: 'id',
        name: { type: 'text', notNull: true },
        description: 'text',
        created_at: 'time_stamp',
        updated_at: 'time_stamp',
    })

    // Survey Questions
    pgm.createTable('survey_question', {
        id: 'id',
        survey_id: {
            type: 'uuid',
            references: 'survey',
            notNull: true,
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        question_text: { type: 'text', notNull: true },
        question_type: { type: 'text', notNull: true },
        order_index: {
            type: 'integer',
            default: 0,
            notNull: true
        },
        choices: {
            type: 'text[]',
            notNull: true,
            default: pgm.func('ARRAY[]::text[]')
        },
        created_at: 'time_stamp',
        updated_at: 'time_stamp'
    })

    // Turf
    pgm.createTable('turf', {
        id: 'id',
        code: { type: 'text', notNull: true, unique: true },
        author_id: {
            type: 'uuid',
            references: { schema: 'auth', name: 'user' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            notNull: true
        },
        survey_id: {
            type: 'uuid',
            references: 'survey',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            notNull: true
        },
        bounds: { type: 'geometry' },
        expires_at: 'time_stamp',
        created_at: 'time_stamp',
        updated_at: 'time_stamp'
    });

    // Locations
    pgm.createTable("location", {
        id: 'id',
        location_name: 'text',
        category: 'text',
        confidence: 'text',
        street: 'text',
        locality: 'text',
        postcode: 'text',
        region: 'text',
        country: 'text',
        latitude: { type: 'numeric(10, 8)', notNull: true },
        longitude: { type: 'numeric(11, 8)', notNull: true },
        geom: { type: 'geometry(point, 4326)' },
        created_at: 'time_stamp',
        updated_at: 'time_stamp'
    });

    pgm.createIndex('location', 'category', {
        name: 'locations_category_idx'
    });
    
    pgm.createIndex('location', 'confidence', {
        name: 'locations_confidence_idx'
    });

    pgm.createIndex('location', 'geom', {
        name: 'locations_geom_idx',
        method: 'gist'
    });

    pgm.createIndex('location', 'locality', {
        name: 'locations_locality_idx'
    });

    pgm.createTrigger('location', 'locations_geom_trigger', {
        when: 'BEFORE',
        operation: ['INSERT', 'UPDATE'],
        function: 'update_geometry',
        level: 'ROW',
    });

    // Turf Location
    pgm.createTable('turf_location', {
        id: 'id',
        turf_id: {
            type: 'uuid',
            references: 'turf',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            notNull: true
        },
        location_id: {
            type: 'uuid',
            references: 'location',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            notNull: true
        },
        created_at: 'time_stamp',
    });

    pgm.addConstraint('turf_location', 'turf_locations_turf_id_location_id_key', {
        unique: [ 'turf_id', 'location_id' ]
    })

    // Location Attempt (MOVED HERE - before survey_question_response)
    pgm.createTable('turf_location_attempt', {
        id: 'id',
        turf_location_id: {
            type: 'uuid',
            references: 'turf_location',
            notNull: true,
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        user_id: {
            type: 'uuid',
            references: { schema: 'auth', name: 'user' },
            notNull: true,
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        attempt_note: 'text',
        contact_made: 'boolean',
        created_at: 'time_stamp',
        updated_at: 'time_stamp'
    })

    pgm.addConstraint('turf_location_attempt', 'turf_location_user_unique', {
        unique: [ 'turf_location_id', 'user_id' ]
    });

    // Survey Question Response (MOVED HERE - after turf_location_attempt)
    pgm.createTable('survey_question_response', {
        id: 'id',
        response_value: 'text',
        survey_question_id: {
            type: 'uuid',
            references: 'survey_question',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            notNull: true
        },
        turf_location_attempt_id: {
            type: 'uuid',
            references: 'turf_location_attempt',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            notNull: true
        },
        created_at: 'time_stamp',
        updated_at: 'time_stamp'
    });

    pgm.addConstraint('survey_question_response', 'survey_question_response_unique', {
        unique: [ 'survey_question_id', 'turf_location_attempt_id' ]
    });

    // Turf User
    pgm.createTable('turf_user', {
        id: 'id',
        turf_id: {
            type: 'uuid',
            references: 'turf',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            notNull: true
        },
        user_id: {
            type: 'uuid',
            references: { schema: 'auth', name: 'user' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            notNull: true
        },
    });

    pgm.addConstraint('turf_user', 'turf_user_unique', {
        unique: [ 'turf_id', 'user_id' ]
    });

}

export async function down(pgm: MigrationBuilder): Promise<void> {}

/*
    Note that it may be best for me to go into better-auth and manually 
    configure all the table and column names to be snake case just to maintain 
    some fucking decorum up in this joint. Like what the fuck?
*/