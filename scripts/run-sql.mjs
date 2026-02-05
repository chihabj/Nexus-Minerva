/**
 * Script pour exécuter du SQL sur Supabase
 * Usage: node scripts/run-sql.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aefzpamcvbzzcgwkuita.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZnpwYW1jdmJ6emNnd2t1aXRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY4NTkwOCwiZXhwIjoyMDgzMjYxOTA4fQ.Q1s_5dc37-HkKomDlbmet5SixnYoHcdA0g8yhFNCx-w';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createStatusLogTable() {
  console.log('🔧 Creating whatsapp_status_log table...\n');

  // Create the table
  const { error: tableError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS whatsapp_status_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        wa_message_id TEXT NOT NULL,
        status TEXT NOT NULL,
        recipient_phone TEXT,
        errors JSONB,
        processed BOOLEAN DEFAULT FALSE,
        processed_at TIMESTAMPTZ,
        message_id UUID REFERENCES messages(id) ON DELETE SET NULL
      );
    `
  });

  if (tableError) {
    // Try direct SQL if RPC doesn't exist
    console.log('⚠️ RPC not available, trying alternative method...');
    
    // Check if table exists by trying to select from it
    const { error: checkError } = await supabase
      .from('whatsapp_status_log')
      .select('id')
      .limit(1);
    
    if (checkError && checkError.code === '42P01') {
      console.log('❌ Table does not exist. Please create it manually in Supabase SQL Editor.');
      console.log('\n📋 SQL to execute:\n');
      console.log(`
CREATE TABLE IF NOT EXISTS whatsapp_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  wa_message_id TEXT NOT NULL,
  status TEXT NOT NULL,
  recipient_phone TEXT,
  errors JSONB,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_status_log_wa_message_id 
ON whatsapp_status_log(wa_message_id);

CREATE INDEX IF NOT EXISTS idx_status_log_unprocessed 
ON whatsapp_status_log(processed) 
WHERE NOT processed;

CREATE INDEX IF NOT EXISTS idx_status_log_created_at 
ON whatsapp_status_log(created_at);
      `);
      return false;
    } else if (!checkError) {
      console.log('✅ Table whatsapp_status_log already exists!');
      return true;
    }
  }

  console.log('✅ Table created successfully!');
  return true;
}

// Test the connection and check table
async function main() {
  try {
    // Test if table exists
    const { data, error } = await supabase
      .from('whatsapp_status_log')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      console.log('❌ Table whatsapp_status_log does not exist yet.');
      console.log('\n📋 Please execute this SQL in Supabase Dashboard > SQL Editor:\n');
      console.log('─'.repeat(60));
      console.log(`
CREATE TABLE IF NOT EXISTS whatsapp_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  wa_message_id TEXT NOT NULL,
  status TEXT NOT NULL,
  recipient_phone TEXT,
  errors JSONB,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_status_log_wa_message_id 
ON whatsapp_status_log(wa_message_id);

CREATE INDEX IF NOT EXISTS idx_status_log_unprocessed 
ON whatsapp_status_log(processed) 
WHERE NOT processed;

CREATE INDEX IF NOT EXISTS idx_status_log_created_at 
ON whatsapp_status_log(created_at);
`);
      console.log('─'.repeat(60));
    } else if (error) {
      console.error('❌ Error:', error.message);
    } else {
      console.log('✅ Table whatsapp_status_log exists!');
      console.log(`   Current rows: ${data?.length || 0}`);
      
      // Get count
      const { count } = await supabase
        .from('whatsapp_status_log')
        .select('*', { count: 'exact', head: true });
      
      console.log(`   Total count: ${count || 0}`);
    }
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

main();
