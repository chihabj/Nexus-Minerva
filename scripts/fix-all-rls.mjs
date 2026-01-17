import pg from 'pg';

const connectionString = 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres';

async function fixAllRLS() {
  console.log('🔧 Fixing RLS policies for all tables...\n');

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tables = ['clients', 'reminders', 'tech_centers', 'client_notes', 'conversations', 'messages', 'notifications', 'reminder_steps', 'reminder_logs'];

  try {
    for (const table of tables) {
      console.log(`\n📋 Fixing ${table}...`);
      
      // Check if table exists
      const { rows: tableExists } = await client.query(`
        SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}');
      `);
      
      if (!tableExists[0].exists) {
        console.log(`   ⚠️ Table ${table} doesn't exist, skipping`);
        continue;
      }

      // Drop existing restrictive policies and create permissive ones
      await client.query(`
        DROP POLICY IF EXISTS "Allow all for ${table}" ON ${table};
        DROP POLICY IF EXISTS "Allow authenticated read ${table}" ON ${table};
        DROP POLICY IF EXISTS "Allow authenticated write ${table}" ON ${table};
      `);

      // Enable RLS
      await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);

      // Create permissive policy for authenticated users
      await client.query(`
        CREATE POLICY "Allow authenticated full access on ${table}"
        ON ${table} FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
      `);

      // Also allow anon for reading (for public data)
      await client.query(`
        CREATE POLICY "Allow anon read on ${table}"
        ON ${table} FOR SELECT
        TO anon
        USING (true);
      `);

      console.log(`   ✅ ${table} policies created`);
    }

    // Verify
    console.log('\n\n📊 Summary of RLS policies:');
    const { rows: policies } = await client.query(`
      SELECT tablename, policyname, cmd 
      FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);
    
    let currentTable = '';
    for (const p of policies) {
      if (p.tablename !== currentTable) {
        currentTable = p.tablename;
        console.log(`\n  ${currentTable}:`);
      }
      console.log(`    - ${p.policyname} (${p.cmd})`);
    }

    console.log('\n\n✅ All RLS policies fixed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

fixAllRLS();
