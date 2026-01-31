const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'deice_postgis_db',
    password: 'b05ccd1decd0e3788e86dc2add0ca596',
    port: 5433,
});

async function runAllSQLFiles(directory) {
    try {
        // Read all files in the directory
        const files = fs.readdirSync(directory)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Sort alphabetically for consistent execution order

        if (files.length === 0) {
            console.log('No SQL files found in directory:', directory);
            return;
        }

        console.log(`Found ${files.length} SQL file(s) to execute:\n`);

        // Execute each SQL file
        for (const file of files) {
            const filePath = path.join(directory, file);
            const sql = fs.readFileSync(filePath, 'utf8');
            
            try {
                console.log(`Executing: ${file}...`);
                await pool.query(sql);
                console.log(`✓ Successfully executed ${file}\n`);
            } catch (error) {
                console.error(`✗ Error executing ${file}:`, error.message);
                throw error; // Stop execution on first error
            }
        }

        console.log('All SQL files executed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Get directory from command line argument or use default
const sqlDirectory = process.argv[2] || './.schema';

console.log(sqlDirectory)

runAllSQLFiles(sqlDirectory);