import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function updateSchema() {
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Allow NULL for name column
    await client.query('ALTER TABLE clients ALTER COLUMN name DROP NOT NULL');
    console.log('✅ name column now allows NULL');
    
    // Add center_name column if not exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients' AND column_name = 'center_name'
    `);
    
    if (checkColumn.rows.length === 0) {
      await client.query('ALTER TABLE clients ADD COLUMN center_name TEXT');
      console.log('✅ center_name column added');
    } else {
      console.log('ℹ️ center_name column already exists');
    }
    
    console.log('\\n🎉 Schema update complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

updateSchema();
