import { ColumnDefinitions, MigrationBuilder, PgLiteral } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions = {
    id: {
        type: 'bigint',
        primaryKey: true,
        sequenceGenerated: {
            precedence: 'BY DEFAULT',
        },
    },
    timeStamp: {
        type: 'timestamp',
        notNull: true,
        default: new PgLiteral('current_timestamp'),
    },
};

export async function up(pgm: MigrationBuilder): Promise<void> {
    pgm.createExtension([
        "postgis",
        "postgis_topology"
    ])

    pgm.createFunction("update_geometry", [], {
        returns: "trigger",
        language: "plpgsql"
    }, `
        BEGIN
            NEW.geom = ST_SetSRID(
                ST_MakePoint(NEW.longitude, NEW.latitude),
                4326
            );
            RETURN NEW;
        END;
    `)

    // Users
    pgm.createTable({ schema: 'auth', name: 'user' }, {
        id: 'id',
        name: { type: 'text', notNull: true },
        email: { type: 'text', notNull: true },
        emailVerified: { type: 'boolean', notNull: true },
        image: "text",
        createdAt: "timeStamp",
        updatedAt: "timeStamp"
    })

    // Session
    pgm.createTable({ schema: 'auth', name: 'session' }, {
        id: 'id',
        userId: {
            type: 'bigint',
            notNull: true,
            references: 'user',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        token: { type: 'text', notNull: true },
        expiresAt: 'timeStamp',
        ipAddress: "text",
        userAgent: "text",
        createdAt: "timeStamp",
        updatedAt: "timeStamp"
    })

    // Account
    pgm.createTable('account', {
        id: 'id',
        userId: {
            type: 'bigint',
            notNull: true,
            references: 'user',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        accountId: { type: 'text', notNull: true },
        providerId: { type: 'text', notNull: true },
        accessToken: 'text',
        refreshToken: 'text',
        accessTokenExpiresAt: { type: 'timestamp' },
        refreshTokenExpiresAt: { type: 'timestamp' },
        scope: 'text',
        idToken: 'text',
        password: 'text',
        createdAt: "timeStamp",
        updatedAt: "timeStamp"
    })

    // Verification
    pgm.createTable('verification', {
        id: 'id',
        identifier: { type: 'text', notNull: true },
        value: { type: 'text', notNull: true },
        expiresAt: 'timeStamp',
        createdAt: "timeStamp",
        updatedAt: "timeStamp"
    })

    // Two Factor

    // Invitation

    // Organization

    // Member (of the org)

    // Spacial Ref Sys (maybe auto gen by postgis??)

    // Verification

    // Locations
    pgm.createTable("location", {
        id: 'id',
        locationName: 'text',
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
        createdAt: 'timeStamp',
        updatedAt: 'timeStamp'
    })

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

    // Location Attempt
    pgm.createTable('location_attempt', {
        id: 'id',
        turfLocation_id: {
            type: 'bigint',
            references: 'location',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        user_id: {
            type: 'text',
            references: { schema: 'auth', name: 'user' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        attempt_note: 'text',
        contact_made: 'boolean',
        created_at: 'timeStamp',
        updated_at: 'timeStamp'
    })

    // Surveys
    pgm.createTable('survey', {
        id: 'id',
        name: { type: 'text', notNull: true },
        decription: 'text',
        created_at: 'timeStamp',
        updated_at: 'timeStamp',
    })

    // Survey Questions
    pgm.createTable('survey_question', {
        id: 'id',
        survey_id: {
            type: 'bigint',
            references: 'survey',
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
        created_at: 'timeStamp',
        updated_at: 'timeStamp'
    })

    // Survey Question Response
    pgm.createTable('survey_question_response', {
        id: 'id',

    })

    // Turf

    // Turf Location

    // Turf User

}

export async function down(pgm: MigrationBuilder): Promise<void> {}

/*
    Note that it may be best for me to go into better-auth and manually 
    configure all the table and column names to be snake case just to maintain 
    some fucking decorum up in this joint. Like what the fuck?
*/