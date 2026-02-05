import { redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: env.DATABASE_URL
});

export async function load({ locals, params, fetch }) {

    if(!locals.user) {
        redirect(302, '/');
    }

    const client = await pool.connect();
    const turfId = params.id;
    const locationId = params.location_id;
    const userId = locals.user.id;
  
    try {

        // 1. Validate turf_location belongs to turf, then get survey
        const surveyResult = await client.query(
            `SELECT t.survey_id 
            FROM turf t
            INNER JOIN turf_location tl ON tl.turf_id = t.id
            WHERE tl.location_id = $1 AND t.id = $2`,
            [locationId, turfId]
        );

        if (surveyResult.rows.length === 0) {
            throw new Error('Survey not found - invalid turf/location combination');
        }

        const surveyId = surveyResult.rows[0].survey_id;        // NOTE: surveyId may be null!

        const location = await client.query(
            `SELECT location_name, street, locality, postcode, region FROM location WHERE id = $1`,
            [ locationId ]
        )

        // 2. From the survey id, get all of the survey questions
        const questionsResult = await client.query(
            `SELECT id, question_text, question_type, order_index, choices
            FROM survey_question
            WHERE survey_id = $1 
            ORDER BY order_index ASC`,
            [surveyId]
        );
        const questions = questionsResult.rows;

        // 3. Create the location attempt if it doesn't already exist

        const turfLocationResult = await client.query(
            'SELECT id FROM turf_location WHERE turf_id = $1 AND location_id = $2;',
            [ turfId, locationId ]
        )
        const turfLocationId = turfLocationResult.rows[0].id

        const locationAttemptResult = await client.query(
            `INSERT INTO turf_location_attempt (turf_location_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT (turf_location_id, user_id) 
            DO UPDATE SET updated_at = NOW()
            RETURNING id, contact_made, attempt_note`,
            [turfLocationId, userId]
        );
        const locationAttempt = locationAttemptResult.rows[0];

        // 4. If any exist, get the responses to each survey question
        let responses = [];
        if (questions.length > 0) {
            const questionIds = questions.map(q => q.id);
            const responsesResult = await client.query(
                `SELECT survey_question_id, response_value, created_at
                FROM survey_question_response 
                WHERE turf_location_attempt_id = $1 
                AND survey_question_id = ANY($2)`,
                [locationAttempt.id, questionIds]
            );
            responses = responsesResult.rows;
        }

        return {
            turfId: turfId,
            location: location.rows[0],
            locationAttempt: locationAttempt,
            surveyId: surveyId,
            questions: questions,
            responses: responses
        };
    } catch (error) {
        console.error('Error in load function:', error);
        throw error;
    } finally {
        client.release();
    }
}