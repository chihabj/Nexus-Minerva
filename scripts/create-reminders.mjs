import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to database...');
  
  // Check reminders table structure
  const { rows: cols } = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'reminders' 
    ORDER BY ordinal_position
  `);
  console.log('\nReminders table columns:');
  cols.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));
  
  // Get all clients
  const { rows: clients } = await client.query('SELECT id, last_visit FROM clients');
  console.log('\nFound', clients.length, 'clients');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
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
    
    console.log(`\nClient: ${c.id}`);
    console.log(`  Last visit: ${lastVisit.toISOString().split('T')[0]}`);
    console.log(`  Due date: ${dueDate}`);
    console.log(`  Reminder date: ${reminderDateStr}`);
    console.log(`  Status: ${status}`);
    
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
      console.log('  ✅ Reminder created');
    } catch (err) {
      console.error('  ❌ Error:', err.message);
    }
  }
  
  console.log('\n✅ Done!');
  await client.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  client.end();
});
