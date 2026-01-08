import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to database...');
  
  // 1. Add due_date column if it doesn't exist
  console.log('\n1. Adding due_date column...');
  try {
    await client.query(`ALTER TABLE reminders ADD COLUMN due_date DATE`);
    console.log('   ✅ due_date column added');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('   ℹ️ due_date column already exists');
    } else {
      console.error('   ❌ Error:', err.message);
    }
  }
  
  // 2. Add message_template column if it doesn't exist (or rename message)
  console.log('\n2. Adding message_template column...');
  try {
    await client.query(`ALTER TABLE reminders ADD COLUMN message_template TEXT`);
    console.log('   ✅ message_template column added');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('   ℹ️ message_template column already exists');
    } else {
      console.error('   ❌ Error:', err.message);
    }
  }
  
  // 3. Check final schema
  console.log('\n3. Final schema:');
  const { rows: cols } = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'reminders' 
    ORDER BY ordinal_position
  `);
  cols.forEach(c => console.log(`   - ${c.column_name}: ${c.data_type}`));
  
  // 4. Delete all existing reminders
  console.log('\n4. Clearing reminders table...');
  await client.query('DELETE FROM reminders');
  console.log('   ✅ Reminders cleared');
  
  // 5. Create reminders for all clients
  console.log('\n5. Creating reminders for all clients...');
  
  const { rows: clients } = await client.query('SELECT id, last_visit FROM clients');
  console.log(`   Found ${clients.length} clients`);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let created = 0;
  for (const c of clients) {
    const lastVisit = new Date(c.last_visit);
    
    // next_visit = last_visit + 2 years
    const nextVisit = new Date(lastVisit);
    nextVisit.setFullYear(nextVisit.getFullYear() + 2);
    
    // reminder_date = due_date - 30 days
    const reminderDate = new Date(nextVisit);
    reminderDate.setDate(reminderDate.getDate() - 30);
    
    // Check if overdue (last_visit > 2 years ago)
    const twoYearsAgo = new Date(today);
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const isOverdue = lastVisit < twoYearsAgo;
    
    const status = isOverdue ? 'Ready' : 'Pending';
    const dueDate = nextVisit.toISOString().split('T')[0];
    const reminderDateStr = reminderDate.toISOString().split('T')[0];
    
    try {
      await client.query(`
        INSERT INTO reminders (client_id, due_date, reminder_date, status, message_template)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        c.id, 
        dueDate, 
        reminderDateStr, 
        status, 
        status === 'Ready' 
          ? 'Votre visite technique est en retard.' 
          : 'Votre prochaine visite technique approche.'
      ]);
      created++;
      console.log(`   ✅ Client ${c.id.slice(0,8)}... - Due: ${dueDate}, Status: ${status}`);
    } catch (err) {
      console.error(`   ❌ Client ${c.id.slice(0,8)}... - Error:`, err.message);
    }
  }
  
  console.log(`\n✅ Done! Created ${created}/${clients.length} reminders`);
  await client.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  client.end();
});
