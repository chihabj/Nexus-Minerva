import pg from 'pg';

const connectionString = 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    
    const { rows: [counts] } = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM clients) as clients,
        (SELECT COUNT(*) FROM conversations) as conversations,
        (SELECT COUNT(*) FROM messages) as messages,
        (SELECT COUNT(*) FROM reminders) as reminders
    `);
    
    const { rows: statusCounts } = await client.query(`
      SELECT status, COUNT(*) as count FROM reminders GROUP BY status ORDER BY count DESC
    `);
    
    console.log('📊 ÉTAT ACTUEL:');
    console.log('   Clients:', counts.clients);
    console.log('   Conversations:', counts.conversations);
    console.log('   Messages:', counts.messages);
    console.log('   Reminders:', counts.reminders);
    console.log('\n📋 Reminders par statut:');
    statusCounts.forEach(s => console.log(`   - ${s.status}: ${s.count}`));
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

main();
