import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('🔄 Creating auth and workflow tables...\n');

  // 1. Create user_profiles table (extends Supabase auth.users)
  console.log('📝 Creating user_profiles table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      full_name TEXT,
      role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('superadmin', 'admin', 'agent')),
      avatar_url TEXT,
      center_id UUID REFERENCES tech_centers(id),
      is_active BOOLEAN DEFAULT true,
      last_login TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('✅ user_profiles table created\n');

  // 2. Create reminder_steps table (defines the workflow)
  console.log('📝 Creating reminder_steps table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS reminder_steps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      step_order INTEGER NOT NULL,
      days_before_due INTEGER NOT NULL,
      action_type TEXT NOT NULL CHECK (action_type IN ('whatsapp', 'call', 'email')),
      template_name TEXT,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('✅ reminder_steps table created\n');

  // 3. Create reminder_logs table (tracks what was sent)
  console.log('📝 Creating reminder_logs table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS reminder_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reminder_id UUID REFERENCES reminders(id) ON DELETE CASCADE,
      step_id UUID REFERENCES reminder_steps(id),
      action_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
      sent_at TIMESTAMPTZ,
      response_received BOOLEAN DEFAULT false,
      response_text TEXT,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('✅ reminder_logs table created\n');

  // 4. Create notifications table
  console.log('📝 Creating notifications table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success', 'action_required')),
      link TEXT,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('✅ notifications table created\n');

  // 5. Update reminders table to support workflow
  console.log('📝 Updating reminders table for workflow...');
  try {
    await client.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS next_action_date TIMESTAMPTZ`);
    await client.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS call_required BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS call_completed BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS call_notes TEXT`);
    console.log('✅ reminders table updated\n');
  } catch (e) {
    console.log('⚠️ Some columns may already exist\n');
  }

  // 6. Create indexes
  console.log('📝 Creating indexes...');
  await client.query(`CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_reminder_logs_reminder_id ON reminder_logs(reminder_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_reminders_next_action ON reminders(next_action_date)`);
  console.log('✅ Indexes created\n');

  // 7. Enable RLS
  console.log('📝 Enabling RLS...');
  await client.query(`ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY`);
  await client.query(`ALTER TABLE reminder_steps ENABLE ROW LEVEL SECURITY`);
  await client.query(`ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY`);
  await client.query(`ALTER TABLE notifications ENABLE ROW LEVEL SECURITY`);

  // Create policies
  await client.query(`DROP POLICY IF EXISTS "Allow all on user_profiles" ON user_profiles`);
  await client.query(`CREATE POLICY "Allow all on user_profiles" ON user_profiles FOR ALL USING (true) WITH CHECK (true)`);
  
  await client.query(`DROP POLICY IF EXISTS "Allow all on reminder_steps" ON reminder_steps`);
  await client.query(`CREATE POLICY "Allow all on reminder_steps" ON reminder_steps FOR ALL USING (true) WITH CHECK (true)`);
  
  await client.query(`DROP POLICY IF EXISTS "Allow all on reminder_logs" ON reminder_logs`);
  await client.query(`CREATE POLICY "Allow all on reminder_logs" ON reminder_logs FOR ALL USING (true) WITH CHECK (true)`);
  
  await client.query(`DROP POLICY IF EXISTS "Allow all on notifications" ON notifications`);
  await client.query(`CREATE POLICY "Allow all on notifications" ON notifications FOR ALL USING (true) WITH CHECK (true)`);
  console.log('✅ RLS enabled\n');

  // 8. Insert default reminder steps (J-30, J-15, J-7, J-5)
  console.log('📝 Inserting default reminder workflow steps...');
  await client.query(`DELETE FROM reminder_steps`); // Clear existing
  await client.query(`
    INSERT INTO reminder_steps (step_order, days_before_due, action_type, template_name, description) VALUES
    (1, 30, 'whatsapp', 'rappel_visite_technique', 'Premier rappel WhatsApp - J-30'),
    (2, 15, 'whatsapp', 'rappel_visite_technique', 'Deuxième rappel WhatsApp - J-15'),
    (3, 7, 'whatsapp', 'rappel_visite_technique', 'Troisième rappel WhatsApp - J-7'),
    (4, 5, 'call', NULL, 'Appel téléphonique requis - J-5')
  `);
  console.log('✅ Default workflow steps inserted\n');

  // 9. Create trigger for auto-creating user profile
  console.log('📝 Creating trigger for user profile...');
  await client.query(`
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.user_profiles (id, email, full_name, role)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'agent')
      );
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER
  `);
  
  // Check if trigger exists and create if not
  await client.query(`
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()
  `);
  console.log('✅ User profile trigger created\n');

  // 10. Enable realtime
  console.log('📝 Enabling Realtime...');
  try {
    await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE notifications`);
    await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE reminder_logs`);
    console.log('✅ Realtime enabled\n');
  } catch (e) {
    console.log('⚠️ Realtime might already be enabled\n');
  }

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
