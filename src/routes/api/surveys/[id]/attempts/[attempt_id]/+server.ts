import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { Pool } from 'pg';
import * as z from "zod";

const pool = new Pool({
  connectionString: env.DATABASE_URL
});

export async function POST({ request, locals, params }) {
  // Check authentication
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  let schema = z.object({
    turf_id: z.uuidv4(),
    contactMade: z.boolean().default(false),
    attemptNote: z.string().default(""),
    questions: z.array(z.object({
      db_id: z.uuidv4(),
      type: z.string().optional(),
      text: z.string().optional(),
      choices: z.array(z.string()).optional(),
      index: z.number().optional(),
      response: z.string()
    }))
  });

  try {
    const { questions, attemptNote, contactMade, turf_id } = await request.json();
    const { attempt_id } = params;
    const client = await pool.connect();
    
    try {

      let val = schema.parse({
        turf_id: turf_id,
        contactMade: contactMade,
        attemptNote: attemptNote,
        questions: questions
      });

      // Check if the user is added to the turf that they are placing a location attempt for!
      // ...
      let response = await client.query(
        'SELECT id FROM turf_user WHERE turf_id = $1 AND user_id = $2',
        [ turf_id, locals.user.id ]
      )

      if(response.rowCount == 0 || response.rowCount == null) {
        throw new Error("User must be a turf user to make a location attempt.");
      }

      await client.query(
        'UPDATE turf_location_attempt SET attempt_note = $1, contact_made = $2, updated_at = NOW() WHERE user_id = $3 AND id = $4',
        [ val.attemptNote, val.contactMade, locals.user.id, attempt_id ]
      )

      // Now we need to update the response if it already exists and insert if it doesn't
      for(let i = 0; i < questions.length; i++) {
        await client.query(
          `INSERT INTO survey_question_response (response_value, survey_question_id, turf_location_attempt_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (survey_question_id, turf_location_attempt_id)
          DO UPDATE SET response_value = $1, updated_at = NOW();`,
          [val.questions[i].response, val.questions[i].db_id, attempt_id]
        );
      }

      return json({ 
        success: true
      }, { status: 201 });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error saving attempt:', error);
    return json({ error: 'Failed to save attempt' }, { status: 500 });
  }
}