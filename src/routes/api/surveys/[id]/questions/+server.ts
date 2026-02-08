import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { Pool } from 'pg';
import { hasSystemAccess } from '$lib/auth-helpers.js';
import * as z from "zod";

const pool = new Pool({
  connectionString: env.DATABASE_URL
});

export async function POST({ request, locals, params }) {

  const SurveyQuestionsSchema = z.array(z.object({
    db_id: z.number().optional(),
    type: z.string().nonempty(),
    text: z.string().nonempty(),
    choices: z.array(z.string().nonempty()),
    index: z.number().int().min(0)
  }))

  // Check authentication
  if (!locals.user || !hasSystemAccess(locals.user.role)) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { questions } = await request.json();
    const { id } = params;
    const client = await pool.connect();

    let schemaResult = SurveyQuestionsSchema.parse(questions);
    
    try {
      for(let i = 0; i < schemaResult.length; i++) {

        if(schemaResult[i].db_id) {
            await client.query(
                'UPDATE survey_question SET question_text = $1, question_type = $2, order_index = $3, choices = $4 WHERE survey_id = $5 AND id = $6;',
                [ schemaResult[i].text, schemaResult[i].type, i, schemaResult[i].choices, id, schemaResult[i].db_id ]
            );
            continue;
        }

        // Create the question if it does't exist already...
        await client.query(
            'INSERT INTO survey_question (question_text, survey_id, question_type, order_index, choices) VALUES ($1, $2, $3, $4, $5);',
            [ schemaResult[i].text, id, schemaResult[i].type, i, schemaResult[i].choices ]
        );
      }

      return json({ 
        success: true
      }, { status: 201 });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error updating questions:', error);
    return json({ error: 'Failed to update questions' }, { status: 500 });
  }
}