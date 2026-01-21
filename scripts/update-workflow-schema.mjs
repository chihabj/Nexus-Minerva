/**
 * Script to update database schema for the new workflow
 * Statuses: New, Pending, Reminder1_sent, Reminder2_sent, Reminder3_sent, 
 *           Onhold, To_be_called, To_be_contacted, Appointment_confirmed, Closed, Completed
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aefzpamcvbzzcgwkuita.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZnpwYW1jdmJ6emNnd2t1aXRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY4NTkwOCwiZXhwIjoyMDgzMjYxOTA4fQ.Q1s_5dc37-HkKomDlbmet5SixnYoHcdA0g8yhFNCx-w';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateSchema() {
  console.log('🔄 Updating workflow schema...\n');

  try {
    // 1. Add new columns to reminders table
    console.log('1️⃣ Adding new columns to reminders table...');
    
    const alterSQL = `
      -- Add updated_at column if not exists
      ALTER TABLE reminders 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      
      -- Add last_reminder_sent to track which reminder was sent
      ALTER TABLE reminders 
      ADD COLUMN IF NOT EXISTS last_reminder_sent TEXT CHECK (last_reminder_sent IN ('J30', 'J15', 'J7'));
      
      -- Add last_reminder_at timestamp
      ALTER TABLE reminders 
      ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;
      
      -- Add response_received_at timestamp
      ALTER TABLE reminders 
      ADD COLUMN IF NOT EXISTS response_received_at TIMESTAMPTZ;
      
      -- Add agent_notes for manual notes
      ALTER TABLE reminders 
      ADD COLUMN IF NOT EXISTS agent_notes TEXT;
      
      -- Drop old status constraint if exists
      ALTER TABLE reminders 
      DROP CONSTRAINT IF EXISTS reminders_status_check;
      
      -- Add new status constraint with all workflow statuses
      ALTER TABLE reminders 
      ADD CONSTRAINT reminders_status_check 
      CHECK (status IN (
        'New', 
        'Pending', 
        'Reminder1_sent', 
        'Reminder2_sent', 
        'Reminder3_sent', 
        'Onhold', 
        'To_be_called', 
        'To_be_contacted', 
        'Appointment_confirmed', 
        'Closed', 
        'Completed'
      ));
      
      -- Create trigger for updated_at
      CREATE OR REPLACE FUNCTION update_reminders_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS reminders_updated_at_trigger ON reminders;
      CREATE TRIGGER reminders_updated_at_trigger
        BEFORE UPDATE ON reminders
        FOR EACH ROW
        EXECUTE FUNCTION update_reminders_updated_at();
    `;

    const { error: alterError } = await supabase.rpc('exec_sql', { sql: alterSQL });
    
    if (alterError) {
      // Try individual statements if batch fails
      console.log('   Trying individual ALTER statements...');
      
      const statements = [
        `ALTER TABLE reminders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
        `ALTER TABLE reminders ADD COLUMN IF NOT EXISTS last_reminder_sent TEXT`,
        `ALTER TABLE reminders ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ`,
        `ALTER TABLE reminders ADD COLUMN IF NOT EXISTS response_received_at TIMESTAMPTZ`,
        `ALTER TABLE reminders ADD COLUMN IF NOT EXISTS agent_notes TEXT`,
      ];
      
      for (const stmt of statements) {
        const { error } = await supabase.rpc('exec_sql', { sql: stmt });
        if (error && !error.message.includes('already exists')) {
          console.log(`   ⚠️ ${stmt.substring(0, 50)}... - ${error.message}`);
        }
      }
    }
    
    console.log('   ✅ Columns added/updated');

    // 2. Update existing reminders to use 'New' status
    console.log('\n2️⃣ Migrating existing statuses...');
    
    // Map old statuses to new ones
    const statusMigrations = [
      { old: 'Ready', new: 'New' },
      { old: 'Sent', new: 'Reminder1_sent' },
      { old: 'Resolved', new: 'Appointment_confirmed' },
      { old: 'Failed', new: 'New' }, // Reset failed to try again
      { old: 'Reminder_1', new: 'Reminder1_sent' },
      { old: 'Reminder_2', new: 'Reminder2_sent' },
      { old: 'Reminder_3', new: 'Reminder3_sent' },
      { old: 'Call_Required', new: 'To_be_called' },
      { old: 'Expired', new: 'Closed' },
    ];

    for (const migration of statusMigrations) {
      const { data, error } = await supabase
        .from('reminders')
        .update({ status: migration.new })
        .eq('status', migration.old)
        .select('id');
      
      if (data && data.length > 0) {
        console.log(`   Migrated ${data.length} reminders: ${migration.old} → ${migration.new}`);
      }
    }
    
    console.log('   ✅ Status migration complete');

    // 3. Update reminder_steps table for new workflow
    console.log('\n3️⃣ Updating reminder_steps for new workflow...');
    
    // Delete old steps
    await supabase.from('reminder_steps').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Insert new workflow steps
    const newSteps = [
      {
        step_order: 1,
        days_before_due: 30,
        action_type: 'whatsapp',
        template_name: 'rappel_visite_technique_vf',
        description: 'Relance J-30 - Premier rappel WhatsApp',
        is_active: true,
      },
      {
        step_order: 2,
        days_before_due: 15,
        action_type: 'whatsapp',
        template_name: 'rappel_visite_technique_vf',
        description: 'Relance J-15 - Deuxième rappel WhatsApp',
        is_active: true,
      },
      {
        step_order: 3,
        days_before_due: 7,
        action_type: 'whatsapp',
        template_name: 'rappel_visite_technique_vf',
        description: 'Relance J-7 - Troisième rappel WhatsApp',
        is_active: true,
      },
      {
        step_order: 4,
        days_before_due: 3,
        action_type: 'call',
        template_name: null,
        description: 'J-3 - Passage en statut "À appeler"',
        is_active: true,
      },
    ];

    const { error: stepsError } = await supabase
      .from('reminder_steps')
      .insert(newSteps);
    
    if (stepsError) {
      console.log('   ⚠️ Steps insert error:', stepsError.message);
    } else {
      console.log('   ✅ Reminder steps updated');
    }

    // 4. Verify the changes
    console.log('\n4️⃣ Verifying changes...');
    
    const { data: reminders } = await supabase
      .from('reminders')
      .select('status')
      .limit(100);
    
    const statusCounts = {};
    reminders?.forEach(r => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });
    
    console.log('   Current status distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`     - ${status}: ${count}`);
    });

    const { data: steps } = await supabase
      .from('reminder_steps')
      .select('*')
      .order('step_order');
    
    console.log('\n   Workflow steps:');
    steps?.forEach(s => {
      console.log(`     ${s.step_order}. J-${s.days_before_due}: ${s.action_type} - ${s.description}`);
    });

    console.log('\n✅ Schema update complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

updateSchema();
