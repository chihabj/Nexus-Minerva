import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to database...');
  
  // Create client_notes table
  console.log('\n1. Creating client_notes table...');
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        author TEXT DEFAULT 'Agent',
        note_type TEXT DEFAULT 'note'
      )
    `);
    console.log('   ✅ client_notes table created');
  } catch (err) {
    console.error('   ❌ Error:', err.message);
  }
  
  // Create index for faster queries
  console.log('\n2. Creating index on client_id...');
  try {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_client_notes_client_id 
      ON client_notes(client_id)
    `);
    console.log('   ✅ Index created');
  } catch (err) {
    console.error('   ❌ Error:', err.message);
  }
  
  // Enable RLS
  console.log('\n3. Enabling RLS...');
  try {
    await client.query(`ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY`);
    console.log('   ✅ RLS enabled');
  } catch (err) {
    if (err.message.includes('already enabled')) {
      console.log('   ℹ️ RLS already enabled');
    } else {
      console.error('   ❌ Error:', err.message);
    }
  }
  
  // Create policy for anon access (for development)
  console.log('\n4. Creating RLS policy...');
  try {
    await client.query(`
      CREATE POLICY "Allow all for client_notes" ON client_notes
      FOR ALL USING (true) WITH CHECK (true)
    `);
    console.log('   ✅ Policy created');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('   ℹ️ Policy already exists');
    } else {
      console.error('   ❌ Error:', err.message);
    }
  }
  
  // Verify table structure
  console.log('\n5. Final schema:');
  const { rows: cols } = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'client_notes' 
    ORDER BY ordinal_position
  `);
  cols.forEach(c => console.log(`   - ${c.column_name}: ${c.data_type}`));
  
  console.log('\n✅ Done!');
  await client.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  client.end();
});
