import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { Pool } from 'pg';
import { hasSystemAccess } from '$lib/auth-helpers.js';

const pool = new Pool({
  connectionString: env.DATABASE_URL
});

export async function PUT({ request, locals, params }) {
  // Check authentication
  if (!locals.user || !hasSystemAccess(locals.user.role)) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, description }: { name: string, description: string } = await request.json();
    const { id } = params;
    const client = await pool.connect();

    if(!name || !description) {
        throw new Error("Requires both a name and a description.");
    }

    if(name == "") {
        throw new Error("Name can not be empty.");
    }
    
    try {
      const result = await client.query(
        'UPDATE survey SET "name" = $1, description = $2 WHERE id = $3;',
        [ name, description, id ]
      );

      return json({ 
        success: true
      }, { status: 201 });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error updating survey:', error);
    return json({ error: 'Failed to update survey' }, { status: 500 });
  }
}