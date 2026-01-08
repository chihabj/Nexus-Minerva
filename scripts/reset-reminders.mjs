import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('🔄 Resetting all reminders to Pending for testing...\n');
  
  // Reset all reminders to Pending
  const result = await client.query(`
    UPDATE reminders 
    SET status = 'Pending', 
        sent_at = NULL, 
        message = NULL
  `);
  
  console.log(`✅ Reset ${result.rowCount} reminders to Pending\n`);
  
  // Show current state
  const { rows } = await client.query(`
    SELECT r.id, r.status, r.due_date, c.phone, c.name 
    FROM reminders r 
    JOIN clients c ON r.client_id = c.id
    ORDER BY r.due_date
  `);
  
  console.log('Current reminders:');
  rows.forEach(row => {
    console.log(`  - ${row.phone} (${row.name || 'No name'}) : ${row.status}`);
  });
  
  await client.end();
}

main().catch(err => {
  console.error('Error:', err);
  client.end();
});
