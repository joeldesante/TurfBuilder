import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { Pool } from 'pg';
import { hasSystemAccess } from '$lib/auth-helpers.js';

const pool = new Pool({
  connectionString: env.DATABASE_URL
});

export async function POST({ request, locals, params }) {
  // Check authentication
  if (!locals.user || !hasSystemAccess(locals.user.role)) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { exclude }: { exclude: number[] | undefined } = await request.json();
    const { id } = params;
    const client = await pool.connect();
    
    try {

      const exclude_ids = exclude || [];
      const result = await client.query(
        'DELETE FROM survey_question WHERE id != ALL($1) AND survey_id = $2;',
        [ exclude_ids, id ]
      );

      return json({ 
        success: true
      }, { status: 201 });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error purging questions:', error);
    return json({ error: 'Failed to purge questions' }, { status: 500 });
  }
}