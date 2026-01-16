import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('🔄 Creating messaging tables...\n');

  // 1. Drop old messages table if exists (it had different schema)
  console.log('📝 Dropping old messages table if exists...');
  await client.query(`DROP TABLE IF EXISTS messages CASCADE`);
  console.log('✅ Old messages table dropped\n');

  // 2. Create conversations table
  console.log('📝 Creating conversations table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
      client_phone TEXT NOT NULL,
      client_name TEXT,
      last_message TEXT,
      last_message_at TIMESTAMPTZ DEFAULT NOW(),
      unread_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'pending')),
      assigned_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('✅ conversations table created\n');

  // 3. Create messages table
  console.log('📝 Creating messages table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
      wa_message_id TEXT UNIQUE,
      from_phone TEXT NOT NULL,
      to_phone TEXT NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
      message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'template', 'image', 'document', 'audio', 'video', 'location', 'reaction', 'system')),
      content TEXT,
      template_name TEXT,
      media_url TEXT,
      status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
      error_message TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('✅ messages table created\n');

  // 4. Create indexes
  console.log('📝 Creating indexes...');
  await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_client_phone ON conversations(client_phone)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_wa_message_id ON messages(wa_message_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC)`);
  console.log('✅ Indexes created\n');

  // 5. Enable RLS
  console.log('📝 Enabling RLS...');
  await client.query(`ALTER TABLE conversations ENABLE ROW LEVEL SECURITY`);
  await client.query(`ALTER TABLE messages ENABLE ROW LEVEL SECURITY`);
  
  // Create policies (allow all for now)
  await client.query(`DROP POLICY IF EXISTS "Allow all on conversations" ON conversations`);
  await client.query(`CREATE POLICY "Allow all on conversations" ON conversations FOR ALL USING (true) WITH CHECK (true)`);
  
  await client.query(`DROP POLICY IF EXISTS "Allow all on messages" ON messages`);
  await client.query(`CREATE POLICY "Allow all on messages" ON messages FOR ALL USING (true) WITH CHECK (true)`);
  console.log('✅ RLS enabled with policies\n');

  // 6. Enable Realtime for messages table
  console.log('📝 Enabling Realtime...');
  try {
    await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE messages`);
    await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE conversations`);
    console.log('✅ Realtime enabled\n');
  } catch (e) {
    console.log('⚠️ Realtime might already be enabled or not available\n');
  }

  // 7. Create function to update conversation on new message
  console.log('📝 Creating trigger function...');
  await client.query(`
    CREATE OR REPLACE FUNCTION update_conversation_on_message()
    RETURNS TRIGGER AS $$
    BEGIN
      UPDATE conversations 
      SET 
        last_message = NEW.content,
        last_message_at = NEW.created_at,
        unread_count = CASE 
          WHEN NEW.direction = 'inbound' THEN unread_count + 1 
          ELSE unread_count 
        END,
        updated_at = NOW()
      WHERE id = NEW.conversation_id;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  await client.query(`DROP TRIGGER IF EXISTS trigger_update_conversation ON messages`);
  await client.query(`
    CREATE TRIGGER trigger_update_conversation
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_message()
  `);
  console.log('✅ Trigger created\n');

  // Show final state
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  console.log('📊 Tables in database:');
  tables.rows.forEach(r => console.log(`  - ${r.table_name}`));

  await client.end();
  console.log('\n✅ All done!');
}

main().catch(err => {
  console.error('Error:', err);
  client.end();
});
