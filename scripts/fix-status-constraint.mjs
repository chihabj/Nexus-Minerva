/**
 * Fix the reminders status CHECK constraint to allow new workflow statuses
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Fixing reminders status constraint...\n');

    // Drop the old constraint
    console.log('1️⃣ Dropping old status constraint...');
    await client.query('ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_status_check');
    console.log('   ✅ Constraint dropped');

    // Update existing data
    console.log('\n2️⃣ Updating existing reminders...');
    const result = await client.query(`UPDATE reminders SET status = 'New' WHERE status = 'Pending'`);
    console.log(`   ✅ Updated ${result.rowCount} reminders to "New"`);

    // Add new columns if they don't exist
    console.log('\n3️⃣ Adding new columns...');
    try {
      await client.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS last_reminder_sent TEXT`);
      await client.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ`);
      await client.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS response_received_at TIMESTAMPTZ`);
      await client.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS agent_notes TEXT`);
      console.log('   ✅ Columns added');
    } catch (err) {
      console.log('   ⚠️ Some columns may already exist:', err.message);
    }

    // Show current data
    const { rows } = await client.query('SELECT status, COUNT(*) as count FROM reminders GROUP BY status');
    console.log('\n4️⃣ Current status distribution:');
    rows.forEach(row => {
      console.log(`   - ${row.status}: ${row.count}`);
    });

    console.log('\n✅ Schema fix complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixSchema();
