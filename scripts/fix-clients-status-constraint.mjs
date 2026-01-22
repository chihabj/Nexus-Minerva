import pg from 'pg';

const connectionString = 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres';

const sslConfig = {
  rejectUnauthorized: false
};

const client = new pg.Client({
  connectionString,
  ssl: sslConfig
});

async function fixClientsStatusConstraint() {
  console.log('🔧 Fixing clients.status CHECK constraint...\n');

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Drop old constraint
    console.log('1️⃣ Dropping old status constraint...');
    await client.query(`
      ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;
    `);
    console.log('   ✅ Old constraint dropped\n');

    // 2. Update default value to 'New'
    console.log('2️⃣ Updating default value to "New"...');
    await client.query(`
      ALTER TABLE clients ALTER COLUMN status SET DEFAULT 'New';
    `);
    console.log('   ✅ Default value updated\n');

    // 3. Add new constraint with all workflow statuses
    console.log('3️⃣ Adding new status constraint with all workflow statuses...');
    await client.query(`
      ALTER TABLE clients ADD CONSTRAINT clients_status_check CHECK (status IN (
        'New', 'Pending', 'Reminder1_sent', 'Reminder2_sent', 'Reminder3_sent',
        'Onhold', 'To_be_called', 'To_be_contacted', 'Appointment_confirmed', 'Closed', 'Completed'
      ));
    `);
    console.log('   ✅ New constraint added\n');

    // 4. Update existing clients with 'Ready' or 'Sent' to 'New'
    console.log('4️⃣ Updating existing clients with old statuses...');
    const { rowCount: updatedCount } = await client.query(`
      UPDATE clients 
      SET status = 'New' 
      WHERE status IN ('Ready', 'Sent', 'Failed');
    `);
    console.log(`   ✅ Updated ${updatedCount} clients to "New"\n`);

    // 5. Verify
    console.log('5️⃣ Verifying constraint...');
    const { rows } = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM clients 
      GROUP BY status 
      ORDER BY count DESC;
    `);
    
    console.log('   Current status distribution:');
    rows.forEach(row => {
      console.log(`     ${row.status}: ${row.count}`);
    });

    console.log('\n✅ Clients status constraint fix complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

fixClientsStatusConstraint();
