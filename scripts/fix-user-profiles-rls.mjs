import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const supabaseUrl = 'https://aefzpamcvbzzcgwkuita.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZnpwYW1jdmJ6emNnd2t1aXRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY4NTkwOCwiZXhwIjoyMDgzMjYxOTA4fQ.Q1s_5dc37-HkKomDlbmet5SixnYoHcdA0g8yhFNCx-w';

const connectionString = 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres';

async function fixRLS() {
  console.log('🔧 Fixing RLS policies for user_profiles...\n');

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // Drop existing policies
    console.log('1️⃣ Dropping existing policies...');
    await client.query(`
      DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
      DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
      DROP POLICY IF EXISTS "Allow all for user_profiles" ON user_profiles;
      DROP POLICY IF EXISTS "user_profiles_read_own" ON user_profiles;
      DROP POLICY IF EXISTS "user_profiles_update_own" ON user_profiles;
    `);
    console.log('   ✅ Old policies dropped');

    // Create new permissive policies
    console.log('\n2️⃣ Creating new RLS policies...');
    
    // Allow authenticated users to read all profiles (needed for admin views)
    await client.query(`
      CREATE POLICY "Allow authenticated users to read profiles"
      ON user_profiles FOR SELECT
      TO authenticated
      USING (true);
    `);
    console.log('   ✅ SELECT policy created');

    // Allow users to update their own profile
    await client.query(`
      CREATE POLICY "Users can update own profile"
      ON user_profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
    `);
    console.log('   ✅ UPDATE policy created');

    // Allow service role to insert profiles
    await client.query(`
      CREATE POLICY "Service role can insert profiles"
      ON user_profiles FOR INSERT
      TO service_role
      WITH CHECK (true);
    `);
    console.log('   ✅ INSERT policy for service_role created');

    // Also allow authenticated to insert (for trigger)
    await client.query(`
      CREATE POLICY "Allow insert for authenticated"
      ON user_profiles FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
    `);
    console.log('   ✅ INSERT policy for authenticated created');

    // Verify RLS is enabled
    console.log('\n3️⃣ Verifying RLS status...');
    const { rows } = await client.query(`
      SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'user_profiles';
    `);
    console.log('   RLS enabled:', rows[0]?.rowsecurity);

    // List all policies
    console.log('\n4️⃣ Current policies on user_profiles:');
    const policies = await client.query(`
      SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_profiles';
    `);
    policies.rows.forEach(p => console.log(`   - ${p.policyname} (${p.cmd})`));

    console.log('\n✅ RLS policies fixed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

fixRLS();
