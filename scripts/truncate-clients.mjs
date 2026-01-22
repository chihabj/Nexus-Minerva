import pg from 'pg';

const connectionString = 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres';

const sslConfig = {
  rejectUnauthorized: false
};

const client = new pg.Client({
  connectionString,
  ssl: sslConfig
});

async function truncateClients() {
  console.log('🗑️  Truncating all clients and related data...\n');

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get count before deletion
    const { rows: countRows } = await client.query(`SELECT COUNT(*) as count FROM clients;`);
    const countBefore = countRows[0].count;
    console.log(`📊 Found ${countBefore} clients to delete\n`);

    // Delete in order (respecting foreign keys)
    console.log('1️⃣ Deleting reminders...');
    await client.query(`DELETE FROM reminders;`);
    console.log('   ✅ Reminders deleted\n');

    console.log('2️⃣ Deleting client notes...');
    await client.query(`DELETE FROM client_notes;`);
    console.log('   ✅ Client notes deleted\n');

    console.log('3️⃣ Deleting conversations...');
    await client.query(`DELETE FROM conversations;`);
    console.log('   ✅ Conversations deleted\n');

    console.log('4️⃣ Deleting messages...');
    await client.query(`DELETE FROM messages;`);
    console.log('   ✅ Messages deleted\n');

    console.log('5️⃣ Deleting clients...');
    await client.query(`DELETE FROM clients;`);
    console.log('   ✅ Clients deleted\n');

    // Verify
    const { rows: verifyRows } = await client.query(`SELECT COUNT(*) as count FROM clients;`);
    const countAfter = verifyRows[0].count;
    
    console.log(`✅ Truncation complete!`);
    console.log(`   Before: ${countBefore} clients`);
    console.log(`   After: ${countAfter} clients`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

truncateClients();
