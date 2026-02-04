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
    // Survey Question Response
    pgm.addColumn('survey_question_response', {
        response_value: 'text',
        survey_question_id: {
            type: 'uuid',
            references: 'survey_question',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            notNull: true
        },
        location_attempt_id: {
            type: 'uuid',
            references: 'location_attempt',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            notNull: true
        },
        created_at: 'time_stamp',
        updated_at: 'time_stamp'
    })

    pgm.addConstraint('survey_question_response', 'survey_question_response_unique', {
        unique: [ 'survey_question_id', 'location_attempt_id' ]
    });

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
