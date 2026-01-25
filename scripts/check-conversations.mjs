import pg from 'pg';

const connectionString = 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    console.log('✅ Connecté\n');

    console.log('📋 CONVERSATIONS:');
    const { rows: conversations } = await client.query(`
      SELECT id, client_id, client_phone, client_name, status, created_at
      FROM conversations
      ORDER BY created_at DESC;
    `);
    console.table(conversations);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

main();
